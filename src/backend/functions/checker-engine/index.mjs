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

async function callLLMWithVision(prompt, imageUrls) {
  const content = [
    ...imageUrls.map(url => ({ type: "image_url", image_url: { url } })),
    { type: "text", text: prompt }
  ];

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: "gpt-5.4-nano",
      messages: [{ role: "user", content }],
      response_format: { type: "json_object" },
      max_completion_tokens: 1024
    })
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI API returned ${res.status}: ${errText}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content || null;
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

              const prompt = `You are a lab grader comparing two screenshots:
- Image 1: Reference (correct submission)
- Image 2: Student's submission

Rules:
- Keyword checks are already done separately — do not repeat them
- Ignore cosmetic differences: theme, window size, account names, timestamps, UI language
- PASSED if the student completed the same task on the same service in a finished state
- REJECTED only if: wrong service, wrong action, or clearly incomplete
- When in doubt, choose PASSED

Reply with JSON only, no other text:
{
  "overall": "PASSED",
  "confidence": 0.95,
  "reason": "<2-3 sentences: overall verdict, what matches, and any notable differences>"
}

confidence is a number from 0.0 to 1.0 representing how certain you are about the verdict.`;

              const llmText = await callLLMWithVision(prompt, [referenceUrl, studentUrl]);

              if (llmText) {
                const jsonMatch = llmText.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                  llmResult       = JSON.parse(jsonMatch[0]);
                  llmFeedback     = llmResult.reason || null;
                  llmConfidence   = llmResult.confidence ?? null;
                  llmCheckSkipped = false;

                  /* LLM can only escalate: flip PASSED → REJECTED, never downgrade */
                  if (llmResult.overall === "REJECTED") {
                    imgStatus = "REJECTED";
                    console.log(`imgId ${shot.imgId} [LLM]: overridden to REJECTED`);
                  } else {
                    console.log(`imgId ${shot.imgId} [LLM]: confirmed PASSED`);
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

      console.log('overall:', overallStatus, 'totalScore:', totalScore);

      /* ── write final result to Submissions table ── */
      await db.send(new UpdateItemCommand({
        TableName: "Submissions",
        Key: marshall({ email, labID }),
        UpdateExpression: "SET #st = :st, scoreResult = :sr, totalScore = :ts, checkedAt = :ca",
        ExpressionAttributeNames: { "#st": "status" },
        ExpressionAttributeValues: marshall({
          ":st": overallStatus,
          ":sr": imageResults,
          ":ts": totalScore,
          ":ca": new Date().toISOString()
        })
      }));

    } catch(err){
      console.error('checkerEngine error:', err);
    }
  }
};