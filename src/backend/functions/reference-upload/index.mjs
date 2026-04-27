import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { TextractClient, DetectDocumentTextCommand } from "@aws-sdk/client-textract";
import { randomUUID } from "crypto";

const s3       = new S3Client({ region: "us-east-1" });
const textract = new TextractClient({ region: "us-east-1" });
const BUCKET   = "lab-checker-reference-duckxy";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

async function callLLMWithVision(prompt, imageBase64, mimeType = "image/png") {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: "gpt-5.4-nano",
      messages: [{
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: `data:${mimeType};base64,${imageBase64}` }
          },
          { type: "text", text: prompt }
        ]
      }],
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
  try {
    let body = typeof event.body === 'string' ? JSON.parse(event.body) : (event.body ?? event);

    const { imageBase64, imageType, labID, enableLLM } = body;
    console.log('[referenceUpload] enableLLM received:', enableLLM, typeof enableLLM);

    if(!imageBase64 || !labID){
      return {
        statusCode: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ success: false, error: "imageBase64 and labID required" })
      };
    }

    /* ── upload to S3 ── */
    const s3Key = `references/${labID}/${randomUUID()}.png`;
    await s3.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: s3Key,
      Body: Buffer.from(imageBase64, 'base64'),
      ContentType: imageType || 'image/png'
    }));

    /* ── run Textract ── */
    const txRes = await textract.send(new DetectDocumentTextCommand({
      Document: { S3Object: { Bucket: BUCKET, Name: s3Key } }
    }));

    /* ── extract text blocks with position ── */
    const blocks = txRes.Blocks
      .filter(b => b.BlockType === "LINE")
      .map(b => ({
        text:   b.Text,
        left:   b.Geometry.BoundingBox.Left,
        top:    b.Geometry.BoundingBox.Top,
        right:  b.Geometry.BoundingBox.Left + b.Geometry.BoundingBox.Width,
        bottom: b.Geometry.BoundingBox.Top  + b.Geometry.BoundingBox.Height,
        cx:     b.Geometry.BoundingBox.Left + b.Geometry.BoundingBox.Width  / 2,
        cy:     b.Geometry.BoundingBox.Top  + b.Geometry.BoundingBox.Height / 2
      }));

    console.log(`Textract found ${blocks.length} text blocks`);

    /* ── LLM vision-based description (optional) ── */
    let llmDescription = null;
    if (enableLLM) {
      try {
        const textContent = blocks.map(b => b.text).join('\n');
        llmDescription = await callLLMWithVision(
          `Analyze this reference lab screenshot and respond in this format only:\n1. Service/Tool: <name of the AWS service or tool>\n2. Action: <what is being done or shown>\n3. State: <expected completion state, e.g. created, running, configured>\n4. Key elements: <critical UI elements or values that must be present in a correct submission>\n5. Notes: <anything else useful for grading>\n\nOCR text:\n${textContent}`,
          imageBase64,
          imageType || 'image/png'
        );
        console.log("LLM description generated:", llmDescription?.substring(0, 100));
      } catch (llmErr) {
        console.error("LLM call failed (non-fatal):", llmErr.message);
      }
    }

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ success: true, s3Key, blocks, llmDescription })
    };

  } catch(err) {
    console.error(err);
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ success: false, error: err.message })
    };
  }
};