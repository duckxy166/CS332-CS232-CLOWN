import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { TextractClient, DetectDocumentTextCommand } from "@aws-sdk/client-textract";
import { randomUUID } from "crypto";

const s3       = new S3Client({ region: "us-east-1" });
const textract = new TextractClient({ region: "us-east-1" });
const BUCKET   = "lab-checker-reference-duckxy";

export const handler = async (event) => {
  try {
    let body = typeof event.body === 'string' ? JSON.parse(event.body) : (event.body ?? event);

    const { imageBase64, imageType, labID } = body;

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

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ success: true, s3Key, blocks })
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