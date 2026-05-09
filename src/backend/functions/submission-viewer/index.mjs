import { DynamoDBClient, ScanCommand, GetItemCommand } from "@aws-sdk/client-dynamodb";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";

const db = new DynamoDBClient({ region: "us-east-1" });
const s3 = new S3Client({ region: "us-east-1" });
const SCREENSHOT_BUCKET = "lab-checker-screenshots-duckxy";
const REFERENCE_BUCKET = "lab-checker-reference-duckxy";
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

    /* ── read params ── */
    const labID = event.queryStringParameters?.labID
           || event.labID
           || (event.body ? JSON.parse(event.body).labID : null);
    const mode  = event.queryStringParameters?.mode || event.mode || null;

    /* ── mode=stats: ONE Scan, return per-lab stats map for the whole table.
         Used by TA dashboard / lab list to avoid the N+1 fan-out of one
         /submissions call per lab. ── */
    if (mode === "stats") {
      const statsByLab = {};
      let lastKey;
      do {
        const r = await db.send(new ScanCommand({
          TableName: "Submissions",
          ProjectionExpression: "labID, #st",
          ExpressionAttributeNames: { "#st": "status" },
          ExclusiveStartKey: lastKey,
        }));
        for (const item of r.Items || []) {
          const u = unmarshall(item);
          const id = u.labID;
          if (!id) continue;
          const s = statsByLab[id] || (statsByLab[id] = { total: 0, passed: 0, rejected: 0, pending: 0 });
          s.total++;
          if (u.status === "PASSED")   s.passed++;
          else if (u.status === "REJECTED") s.rejected++;
          else                              s.pending++;
        }
        lastKey = r.LastEvaluatedKey;
      } while (lastKey);

      return {
        statusCode: 200,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ success: true, statsByLab }),
      };
    }

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

    /* ── presign reference images keyed by imgId ── */
    const refUrlByImgId = {};
    const refKeyByImgId = {};
    for (const im of (lab?.images || [])) {
      const imgId = Number(im.id ?? im.imgId ?? im.slot);
      const refKey = im.refS3Key || im.s3Key;
      if (!refKey || Number.isNaN(imgId)) continue;
      refKeyByImgId[imgId] = refKey;
      try {
        refUrlByImgId[imgId] = await getSignedUrl(
          s3,
          new GetObjectCommand({ Bucket: REFERENCE_BUCKET, Key: refKey }),
          { expiresIn: PRESIGN_EXPIRY }
        );
      } catch (e) {
        console.warn("presign ref failed for", refKey, e.message);
      }
    }

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
            const imgIdNum = Number(shot.imgId);
            return {
              imgId: shot.imgId,
              s3Key: shot.s3Key,
              url,
              refS3Key: refKeyByImgId[imgIdNum] || null,
              refUrl:   refUrlByImgId[imgIdNum] || null,
            };
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
        /* return the full lab object — TaViewSubmission needs description,
           rules, deadline, etc. and was previously fetching /labs again
           (full Scan) just to get them. */
        lab: lab || null,
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