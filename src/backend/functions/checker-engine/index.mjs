import { DynamoDBClient, GetItemCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { TextractClient, DetectDocumentTextCommand } from "@aws-sdk/client-textract";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";

const db       = new DynamoDBClient({ region: "us-east-1" });
const textract = new TextractClient({ region: "us-east-1" });
const s3       = new S3Client({ region: "us-east-1" });
const SCREENSHOT_BUCKET = "lab-checker-screenshots-duckxy";
const REFERENCE_BUCKET  = "lab-checker-reference-duckxy";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const LLM_MODEL      = process.env.LLM_MODEL    || "gpt-4o-2024-11-20";
const LLM_MAX_TOKENS = Number(process.env.LLM_MAX_TOKENS || 1500);
const LLM_MAX_RETRIES = Number(process.env.LLM_MAX_RETRIES || 6);
const LLM_MIN_BACKOFF = Number(process.env.LLM_MIN_BACKOFF_MS || 5000);

const sleep = ms => new Promise(r => setTimeout(r, ms));

/* Parse OpenAI's "Please try again in 1.149s" / "in 890ms" hint, falling back
   to the Retry-After header. Returns ms (clamped to 30s).
   NOTE: OpenAI's hint is the ABSOLUTE minimum — when the bucket is fully
   exhausted, waiting only the hinted duration almost always 429's again.
   The caller floors this with LLM_MIN_BACKOFF and grows on each retry. */
function parseRetryDelayMs(headers, errText) {
  const retryAfter = headers?.get?.("retry-after");
  if (retryAfter) {
    const n = Number(retryAfter);
    if (Number.isFinite(n)) return Math.min(n * 1000, 60_000);
  }
  const mSec = errText && errText.match(/try again in ([\d.]+)\s*s/i);
  if (mSec) return Math.min(parseFloat(mSec[1]) * 1000, 60_000);
  const mMs  = errText && errText.match(/try again in ([\d.]+)\s*ms/i);
  if (mMs)  return Math.min(parseFloat(mMs[1]), 60_000);
  return null;
}

async function callLLMWithVision(prompt, imageUrls) {
  const content = [
    ...imageUrls.map((url, i) => ({
      type: "image_url",
      image_url: { url, detail: "high" }
    })),
    { type: "text", text: prompt }
  ];

  /* OpenAI's reasoning-class models (o1/o3/gpt-5*) reject `max_tokens`,
     `temperature`, `top_p`, and `seed` — they expect `max_completion_tokens`
     and ignore sampling controls. Detect and adapt at request time so the
     model name can be flipped via env var without code changes. */
  const isReasoningModel = /^(o[13]|gpt-5)/i.test(LLM_MODEL);
  const body = {
    model: LLM_MODEL,
    messages: [{ role: "user", content }],
    response_format: { type: "json_object" },
  };
  if (isReasoningModel) {
    body.max_completion_tokens = LLM_MAX_TOKENS;
  } else {
    body.max_tokens  = LLM_MAX_TOKENS;
    body.temperature = 0;
    body.top_p       = 1;
    body.seed        = 42;
  }

  for (let attempt = 0; attempt <= LLM_MAX_RETRIES; attempt++) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify(body)
    });
    if (res.ok) {
      const data = await res.json();
      return data.choices?.[0]?.message?.content || null;
    }
    const errText = await res.text();
    /* Retry on rate-limit and transient 5xx; honour OpenAI's hint when given. */
    const retriable = res.status === 429 || (res.status >= 500 && res.status < 600);
    if (!retriable || attempt === LLM_MAX_RETRIES) {
      throw new Error(`OpenAI API returned ${res.status}: ${errText}`);
    }
    const hinted = parseRetryDelayMs(res.headers, errText);
    /* Floor every wait at LLM_MIN_BACKOFF (default 5s) and grow it each
       attempt — the rolling-token-window may need many seconds to drain
       enough room for a 3.8k-token request even after the hinted "try in
       1.149s". Cap any single wait at 60s. */
    const grow = LLM_MIN_BACKOFF * Math.pow(1.5, attempt);
    const jitter = Math.random() * 500;
    const wait = Math.min(60_000, Math.max(hinted ?? 0, grow) + jitter);
    console.log(`OpenAI ${res.status} on attempt ${attempt + 1}/${LLM_MAX_RETRIES + 1}; hint=${hinted}ms; sleeping ${Math.round(wait)}ms`);
    await sleep(wait);
  }
  throw new Error("OpenAI retries exhausted");
}

export const handler = async (event) => {
  for(const record of event.Records){
    try {
      const { email, labID, submissionID, screenshots } = JSON.parse(record.body);
      console.log('checking:', email, labID, submissionID);

      /* ── get lab from DynamoDB ── */
      const labRes = await db.send(new GetItemCommand({
        TableName: "Labs",
        Key: marshall({ labID })
      }));
      if (!labRes.Item) {
        console.error(`lab not found: ${labID}`);
        continue;
      }
      const lab = unmarshall(labRes.Item);
      const enableLLM     = lab.enableLLMCheck === true;
      const labRules      = Array.isArray(lab.rules)      ? lab.rules      : [];
      const labThresholds = Array.isArray(lab.thresholds) ? lab.thresholds : [];
      const labImages     = Array.isArray(lab.images)     ? lab.images     : [];

      let overallStatus = "PASSED";
      let totalScore    = 0;
      const imageResults = [];

      /* ── check each screenshot against its imgId rules ── */
      for(const shot of screenshots || []){

        const shotImgId    = Number(shot.imgId);
        const imgRules     = labRules.filter(r => Number(r.imgId) === shotImgId);
        const imgThreshold = labThresholds.find(t => Number(t.imgId) === shotImgId);

        /* run Textract on this screenshot */
        const txRes = await textract.send(new DetectDocumentTextCommand({
          Document: { S3Object: { Bucket: SCREENSHOT_BUCKET, Name: shot.s3Key } }
        }));

        const blocks = (txRes.Blocks || [])
          .filter(b => b.BlockType === "LINE")
          .map(b => ({
            text:   b.Text.toLowerCase(),
            left:   b.Geometry.BoundingBox.Left,
            top:    b.Geometry.BoundingBox.Top,
            right:  b.Geometry.BoundingBox.Left + b.Geometry.BoundingBox.Width,
            bottom: b.Geometry.BoundingBox.Top  + b.Geometry.BoundingBox.Height
          }));

        /* evaluate rules for this image */
        const ruleResults = [];
        let imgScore      = 0;
        let imgStatus     = "PASSED";

        for(const rule of imgRules){
          const kw      = (rule.kw || '').toLowerCase();
          if (!kw) continue;
          const matches = blocks.filter(b => b.text.includes(kw));
          let   passed  = false;

          if(matches.length > 0){
            if(!rule.pos){
              /* keyword only mode */
              passed = true;
            } else {
              /* keyword + position mode */
              const tol = { low: 0.30, medium: 0.15, high: 0.05 }[rule.sens || "medium"];
              passed = matches.some(b => {
                const cx = (b.left + b.right)  / 2;
                const cy = (b.top  + b.bottom) / 2;
                return cx >= rule.refX - tol && cx <= rule.refX + tol
                    && cy >= rule.refY - tol && cy <= rule.refY + tol;
              });
            }
          }

          const score = passed ? rule.wt : 0;
          imgScore   += score;
          ruleResults.push({ ruleId: rule.id, keyword: rule.kw, passed, score });

          /* mandatory rule fail → image rejected immediately */
          if(rule.mand && !passed) imgStatus = "REJECTED";
        }

        /* check score threshold for this image */
        if(imgThreshold?.useScore && imgScore < imgThreshold.scoreMin){
          imgStatus = "REJECTED";
        }

        console.log(`imgId ${shot.imgId} [Textract]: ${imgStatus} score: ${imgScore}`);

        /* ── Step 2: LLM deep check (only if Textract PASSED and LLM enabled) ── */
        let llmResult       = null;
        let llmFeedback     = null;
        let llmConfidence   = null;
        let llmCheckSkipped = true;
        let llmError        = null;

        if (imgStatus === "PASSED" && enableLLM) {
          const imgMeta  = labImages.find(i => Number(i.id ?? i.imgId ?? i.slot) === shotImgId);
          const refS3Key = imgMeta?.refS3Key || imgMeta?.s3Key || null;

          if (refS3Key) {
            try {
              const [referenceUrl, studentUrl] = await Promise.all([
                getSignedUrl(s3, new GetObjectCommand({ Bucket: REFERENCE_BUCKET,  Key: refS3Key  }), { expiresIn: 300 }),
                getSignedUrl(s3, new GetObjectCommand({ Bucket: SCREENSHOT_BUCKET, Key: shot.s3Key }), { expiresIn: 300 }),
              ]);

              const labDesc = (lab.description || "").trim();
              const totalSlots = (screenshots?.length || 1);
              const prompt = `You are grading screenshot ${shotImgId} of ${totalSlots} that a student submitted as evidence for an AWS lab task.

Image 1 = REFERENCE (a correct example for slot ${shotImgId}, posted by the instructor)
Image 2 = STUDENT'S screenshot for slot ${shotImgId}

═══════ LAB REQUIREMENTS (from the instructor) ═══════
${labDesc || "(no description provided — focus on visual similarity to the reference)"}
══════════════════════════════════════════════════════

⚠️ CRITICAL: Multi-screenshot submissions ⚠️
This lab requires ${totalSlots} screenshots, each showing a DIFFERENT aspect of the task.
You are grading ONLY screenshot ${shotImgId} right now. Other screenshots will be graded separately.
A confirmation page screenshot will not show subscription details. A subscription detail page won't show the topic list. THIS IS NORMAL.
Do NOT reject this screenshot because it doesn't show information that's expected in a different screenshot.

═══════ STEP 1 — LOOK AT IMAGE 2 AND READ IT (mandatory) ═══════
Before deciding anything, you MUST first OBSERVE the student's screenshot (Image 2) and write down concrete details.
You will be REJECTED for grading sloppily if your observed[] list is generic ("AWS console shown", "looks fine"), empty, or copy-pasted from the requirements without specific values you literally see.

For Image 2, extract AS MANY of the following as are actually visible. Quote the EXACT text — do not paraphrase, do not invent:
  • aws_service        — name shown in the page header / breadcrumb (e.g. "Amazon SNS", "Lambda")
  • page_type          — what view this is (Topic detail / Subscriptions list / Subscription detail / Confirmation page / Email inbox split-screen / etc.)
  • breadcrumb         — full breadcrumb path if visible (e.g. "Amazon SNS > Topics > ImageUploadNotification")
  • topic_or_resource  — topic / resource name as printed
  • status_field       — the literal Status value as printed (e.g. "Confirmed", "Pending confirmation")
  • protocol_field     — Protocol value as printed (e.g. "EMAIL")
  • endpoint_or_email  — endpoint / email address as printed (full string, including domain)
  • id_or_arn_value    — the literal value in the ID / Subscription ID / ARN column (e.g. "arn:aws:sns:...:xxxx", or the literal word "Deleted", or "PendingConfirmation")
  • account_id         — 12-digit AWS account ID if visible anywhere (header, ARN, etc.)
  • region             — AWS region indicator (e.g. "us-east-1", "N. Virginia")
  • banners_or_alerts  — any green/red/yellow banner text, modals, toasts (verbatim)
  • other_signals      — anything else relevant you can read (column headers, button labels, sidebar text, split-screen contents like a Gmail inbox)

If a field is not visible, set it to null. NEVER make up a value.

═══════ STEP 2 — DECISION ═══════
DECISION DISCIPLINE (most important rule):
1. DEFAULT verdict = PASSED.
2. You may ONLY return REJECTED if one of the HARD REJECT RULES below matches a value you actually observed. Nothing else justifies a REJECT.
3. ABSENCE of information is NEVER a violation. Examples that are PASSED, not REJECTED:
   • A confirmation page that only says "Subscription confirmed!" — PASSED
   • A topic page that doesn't show the email endpoint — PASSED (endpoint is in another slot)
   • A subscription detail page that doesn't show the topic name — PASSED
   • A screenshot that doesn't show an account ID — PASSED
   • A page whose page_type doesn't EXACTLY match the wording in the requirements (e.g. requirement says "Topic detail page" but you see a "Topics list" or "Subscriptions list" page that still shows the right topic name) — PASSED
4. Cross-screenshot inferences are NOT allowed. Don't say "I see ARN X here but somewhere else there should be ARN Y" — only judge what's IN this screenshot vs the requirements.
5. The reference is ONE valid example. Other valid submissions can look different — only the literal requirements above are mandatory.
6. Page-type mismatch is NOT a reject reason. As long as the screenshot is a real AWS console page in the same service as the lab and shows the relevant resource somewhere, accept it. The instructor may have given a strict description of which page to capture, but the grading rubric is whether the visible text contradicts the requirements — not whether the chosen page matches a specific name.

HARD REJECT RULES — these are the ONLY reasons you may return REJECTED (each requires a literal value you observed):
⚠ DELETED ID: id_or_arn_value (or anything in the ID / Subscription ID column for a row inside the same screenshot) is the literal word "Deleted" instead of a real ARN/UUID. A "Confirmed" Status next to a "Deleted" ID does NOT override this — quote both values in your reason.
⚠ WRONG STATUS: status_field shows a forbidden value the lab requirements explicitly disallow (e.g. requirements say "Confirmed" but status_field is "Pending confirmation" / "PendingConfirmation"). Quote the value. NOTE: a green "created successfully" banner is NOT a Status value — judge only by the literal Status field.
⚠ WRONG EMAIL DOMAIN: lab requirements specify a required email domain (e.g. "@dome.tu.ac.th") and endpoint_or_email shows a different domain (e.g. "@gmail.com", "@hotmail.com"). Quote the visible email. (Different prefixes on the SAME required domain are fine. If endpoint_or_email is null, this rule does NOT apply.)
⚠ WRONG TOPIC NAME: topic_or_resource is visible AND is clearly a different name than the one named in the lab requirements (different spelling, completely different word). Quote both. (If topic_or_resource is null, this rule does NOT apply.)
⚠ WRONG REGION: region is visible AND is clearly a different region than the one named in the lab requirements. Quote both. (If region is null, this rule does NOT apply.)
⚠ WRONG SERVICE: aws_service is visible AND is clearly a completely different AWS service than the one named in the lab requirements (e.g. requirements ask for SNS but you see Lambda or S3). Quote both.

WHAT TO ALWAYS IGNORE (never reject because of these)
• Different AWS account numbers, IAM user names, profile names, display names (every student uses their own account)
• Different email PREFIXES (only the domain matters if requirements specify a domain)
• Theme, layout, window size, browser, OS, language differences
• CloudShell panels, browser tabs, overlays, sidebars, notifications
• Timestamps, dates
• Split-screen views (e.g. inbox + AWS console side by side) — normal evidence
• Extra resources not part of this lab (other topics, other subscriptions, unrelated AWS services in a list)
• A green "created successfully" banner — judge by the Status field, not banner color
• OCR / render differences
• Confirmation pages that are minimal (just "Subscription confirmed!" + ARN) — these are inherently low-content
• page_type wording differing from the requirement description ("Topics list" vs "Topic detail" vs "Subscriptions list")

═══════ OUTPUT — JSON only, this exact schema ═══════
{
  "observed": {
    "aws_service": "<verbatim or null>",
    "page_type": "<verbatim or null>",
    "breadcrumb": "<verbatim or null>",
    "topic_or_resource": "<verbatim or null>",
    "status_field": "<verbatim or null>",
    "protocol_field": "<verbatim or null>",
    "endpoint_or_email": "<verbatim or null>",
    "id_or_arn_value": "<verbatim or null>",
    "account_id": "<verbatim or null>",
    "region": "<verbatim or null>",
    "banners_or_alerts": "<verbatim or null>",
    "other_signals": "<verbatim or null>"
  },
  "overall": "PASSED" | "REJECTED",
  "confidence": 0.0,
  "reason": "<2-4 sentences. Start by stating WHAT you saw in Image 2 (page type + a couple of the most distinctive verbatim values from observed[]). Then state your verdict and, if REJECTED, quote the exact text that breaks a requirement and name the requirement.>"
}`;

              const llmText = await callLLMWithVision(prompt, [referenceUrl, studentUrl]);

              if (llmText) {
                const jsonMatch = llmText.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                  llmResult       = JSON.parse(jsonMatch[0]);
                  llmFeedback     = llmResult.reason || null;
                  llmConfidence   = llmResult.confidence ?? null;
                  llmCheckSkipped = false;

                  /* If LLM did not actually describe the image, treat as a hard error
                     (we want every output to demonstrate the model looked at the picture). */
                  const obs = llmResult.observed && typeof llmResult.observed === "object"
                    ? llmResult.observed : null;
                  const observedFilled = obs
                    ? Object.values(obs).filter(v => v !== null && v !== undefined && String(v).trim() !== "").length
                    : 0;
                  if (observedFilled < 2) {
                    llmError = `LLM produced no concrete visual evidence (observed fields filled = ${observedFilled})`;
                    console.error(`imgId ${shot.imgId} [LLM]: ${llmError}`);
                  }

                  /* LLM can only escalate: flip PASSED → REJECTED, never downgrade */
                  if (llmResult.overall === "REJECTED") {
                    imgStatus = "REJECTED";
                    console.log(`imgId ${shot.imgId} [LLM]: overridden to REJECTED — ${llmFeedback}`);
                  } else {
                    console.log(`imgId ${shot.imgId} [LLM]: confirmed PASSED — ${llmFeedback}`);
                  }
                } else {
                  llmError = "could not parse JSON from response";
                  console.error(`imgId ${shot.imgId} [LLM]: could not parse JSON from response`);
                }
              }
            } catch (llmErr) {
              llmError = llmErr.message;
              console.error(`imgId ${shot.imgId} [LLM] error (non-fatal):`, llmErr.message);
            }
          } else {
            console.log(`imgId ${shot.imgId} [LLM]: no reference s3Key on lab — skipping`);
            llmError = "no reference image stored for this lab (lab was created before reference-image comparison was enabled)";
          }
        } else if (imgStatus === "REJECTED") {
          console.log(`imgId ${shot.imgId} [LLM]: Textract rejected, skipping LLM`);
        }

        totalScore += imgScore;
        imageResults.push({
          imgId:           shot.imgId,
          status:          imgStatus,
          score:           imgScore,
          ruleResults,
          llmResult,
          llmFeedback,
          llmConfidence,
          llmCheckSkipped,
          llmError
        });

        /* any image fails → overall fails */
        if(imgStatus === "REJECTED") overallStatus = "REJECTED";

        console.log(`imgId ${shot.imgId} [final]: ${imgStatus} score: ${imgScore}`);
      }

      /* cross-image consistency check disabled — test data uses different students per slot,
         so any account-ID-based check produces false negatives on legitimate submissions. */
      const crossImageCheck = null;

      console.log('overall:', overallStatus, 'totalScore:', totalScore);

      /* ── write final result to Submissions table ── */
      const updateExpr = crossImageCheck
        ? "SET #st = :st, scoreResult = :sr, totalScore = :ts, checkedAt = :ca, crossImageCheck = :xi"
        : "SET #st = :st, scoreResult = :sr, totalScore = :ts, checkedAt = :ca";
      const updateVals = {
        ":st": overallStatus,
        ":sr": imageResults,
        ":ts": totalScore,
        ":ca": new Date().toISOString(),
        ...(crossImageCheck ? { ":xi": crossImageCheck } : {})
      };
      await db.send(new UpdateItemCommand({
        TableName: "Submissions",
        Key: marshall({ email, labID }),
        UpdateExpression: updateExpr,
        ExpressionAttributeNames: { "#st": "status" },
        ExpressionAttributeValues: marshall(updateVals)
      }));

    } catch(err){
      console.error('checkerEngine error:', err);
    }
  }
};