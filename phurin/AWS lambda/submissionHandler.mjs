import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { marshall } from "@aws-sdk/util-dynamodb";
import { randomUUID } from "crypto";

const db  = new DynamoDBClient({ region: "us-east-1" });
const s3  = new S3Client({ region: "us-east-1" });
const sqs = new SQSClient({ region: "us-east-1" });

const SCREENSHOT_BUCKET = "lab-checker-screenshots";
const QUEUE_URL = "https://sqs.us-east-1.amazonaws.com/080259501101/lab-checker-queue";

export const handler = async (event) => {
  try {
    let body = typeof event.body === 'string' ? JSON.parse(event.body) : (event.body ?? event);
    console.log('body received:', JSON.stringify({ email: body.email, labID: body.labID }));

    const { email, labID, screenshots } = body;
    /* screenshots = [{ imgId: 1, imageBase64: "...", imageType: "image/png" }, ...] */

    if(!email || !labID || !screenshots?.length){
      return {
        statusCode: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ success: false, error: "email, labID and screenshots required" })
      };
    }

    /* ── upload each screenshot to S3 in order ── */
    const uploadedScreenshots = [];
    for(const shot of screenshots){
      const s3Key = `submissions/${labID}/${email}/img${shot.imgId}-${randomUUID()}.png`;
      await s3.send(new PutObjectCommand({
        Bucket: SCREENSHOT_BUCKET,
        Key: s3Key,
        Body: Buffer.from(shot.imageBase64, 'base64'),
        ContentType: shot.imageType || 'image/png'
      }));
      uploadedScreenshots.push({ imgId: shot.imgId, s3Key });
    }

    /* ── create Submissions record ── */
    const submissionID = randomUUID();
    await db.send(new PutItemCommand({
      TableName: "Submissions",
      Item: marshall({
        email,
        labID,
        submissionID,
        screenshots: uploadedScreenshots,
        status: "PENDING",
        submittedAt: new Date().toISOString()
      })
    }));

    /* ── push to SQS ── */
    await sqs.send(new SendMessageCommand({
      QueueUrl: QUEUE_URL,
      MessageBody: JSON.stringify({ email, labID, submissionID, screenshots: uploadedScreenshots })
    }));

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ success: true, submissionID })
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