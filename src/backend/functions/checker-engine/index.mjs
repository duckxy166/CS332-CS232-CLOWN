import { DynamoDBClient, GetItemCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { TextractClient, DetectDocumentTextCommand } from "@aws-sdk/client-textract";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";

const db       = new DynamoDBClient({ region: "us-east-1" });
const textract = new TextractClient({ region: "us-east-1" });
const SCREENSHOT_BUCKET = "lab-checker-screenshots-duckxy";

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
      const lab = unmarshall(labRes.Item);

      let overallStatus = "PASSED";
      let totalScore    = 0;
      const imageResults = [];

      /* ── check each screenshot against its imgId rules ── */
      for(const shot of screenshots){

        const imgRules     = lab.rules.filter(r => r.imgId === shot.imgId);
        const imgThreshold = lab.thresholds.find(t => t.imgId === shot.imgId);

        /* run Textract on this screenshot */
        const txRes = await textract.send(new DetectDocumentTextCommand({
          Document: { S3Object: { Bucket: SCREENSHOT_BUCKET, Name: shot.s3Key } }
        }));

        const blocks = txRes.Blocks
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
          const kw      = rule.kw.toLowerCase();
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

        totalScore += imgScore;
        imageResults.push({
          imgId:       shot.imgId,
          status:      imgStatus,
          score:       imgScore,
          ruleResults
        });

        /* any image fails → overall fails */
        if(imgStatus === "REJECTED") overallStatus = "REJECTED";

        console.log(`imgId ${shot.imgId}: ${imgStatus} score: ${imgScore}`);
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