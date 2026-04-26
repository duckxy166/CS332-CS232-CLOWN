import { DynamoDBClient, ScanCommand, GetItemCommand } from "@aws-sdk/client-dynamodb";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";

const db = new DynamoDBClient({ region: "us-east-1" });
const s3 = new S3Client({ region: "us-east-1" });
const SCREENSHOT_BUCKET = "lab-checker-screenshots-65401";
const PRESIGN_EXPIRY = 900; // 15 minutes

export const handler = async (event) => {
  try {
    /* ── CORS preflight ── */
    if (event.httpMethod === "OPTIONS") {
      return {
        statusCode: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET,OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
        body: "",
      };
    }

    /* ── read labID from query string ── */
    const labID = event.queryStringParameters?.labID 
           || event.labID
           || (event.body ? JSON.parse(event.body).labID : null);
           
    if (!labID) {
      return {
        statusCode: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ success: false, error: "labID query parameter required" }),
      };
    }

    /* ── fetch lab info ── */
    const labRes = await db.send(
      new GetItemCommand({
        TableName: "Labs",
        Key: marshall({ labID }),
      })
    );
    const lab = labRes.Item ? unmarshall(labRes.Item) : null;

    /* ── scan submissions filtered by labID ── */
    let allItems = [];
    let lastKey = undefined;

    do {
      const scanRes = await db.send(
        new ScanCommand({
          TableName: "Submissions",
          FilterExpression: "labID = :lid",
          ExpressionAttributeValues: marshall({ ":lid": labID }),
          ExclusiveStartKey: lastKey,
        })
      );
      allItems.push(...(scanRes.Items || []).map((i) => unmarshall(i)));
      lastKey = scanRes.LastEvaluatedKey;
    } while (lastKey);

    /* ── generate presigned URLs for each screenshot ── */
    const submissions = await Promise.all(
      allItems.map(async (sub) => {
        const screenshotsWithUrls = await Promise.all(
          (sub.screenshots || []).map(async (shot) => {
            let url = null;
            try {
              url = await getSignedUrl(
                s3,
                new GetObjectCommand({
                  Bucket: SCREENSHOT_BUCKET,
                  Key: shot.s3Key,
                }),
                { expiresIn: PRESIGN_EXPIRY }
              );
            } catch (e) {
              console.warn("presign failed for", shot.s3Key, e.message);
            }
            return { imgId: shot.imgId, s3Key: shot.s3Key, url };
          })
        );

        return {
          email: sub.email,
          submissionID: sub.submissionID,
          status: sub.status,
          totalScore: sub.totalScore ?? null,
          scoreResult: sub.scoreResult ?? [],
          screenshots: screenshotsWithUrls,
          submittedAt: sub.submittedAt ?? null,
          checkedAt: sub.checkedAt ?? null,
        };
      })
    );

    /* ── compute stats ── */
    const stats = {
      total: submissions.length,
      passed: submissions.filter((s) => s.status === "PASSED").length,
      rejected: submissions.filter((s) => s.status === "REJECTED").length,
      pending: submissions.filter((s) => s.status === "PENDING").length,
    };

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        success: true,
        lab: lab
          ? {
              labID:       lab.labID,
              labName:     lab.labName,
              subjectId:   lab.subjectId,
              sections:    lab.sections,
              deadline:    lab.deadline    || null,
              description: lab.description || "",
              rules:       lab.rules       || [],
              thresholds:  lab.thresholds  || [],
              images:      lab.images      || [],
            }
          : null,
        stats,
        submissions,
      }),
    };
  } catch (err) {
    console.error("submissionViewer error:", err);
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ success: false, error: err.message }),
    };
  }
};