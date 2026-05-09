import { DynamoDBClient, GetItemCommand, QueryCommand } from "@aws-sdk/client-dynamodb";
import { unmarshall, marshall } from "@aws-sdk/util-dynamodb";

const db = new DynamoDBClient({ region: "us-east-1" });

export const handler = async (event) => {
  try {
    let body = typeof event.body === 'string' ? JSON.parse(event.body) : (event.body ?? event);

    const email = event.queryStringParameters?.email || body.email;
    const labID = event.queryStringParameters?.labID || body.labID;
    const mode  = event.queryStringParameters?.mode  || body.mode || null;

    /* ── mode=mine: Query all submissions for one email (uses partition key,
         no Scan). Replaces the N+1 pattern of one /result?labID= call per lab
         on student dashboard / lab-list pages. ── */
    if (mode === "mine") {
      if (!email) {
        return {
          statusCode: 400,
          headers: { "Access-Control-Allow-Origin": "*" },
          body: JSON.stringify({ success: false, error: "email required for mode=mine" })
        };
      }
      const submissionsByLab = {};
      let lastKey;
      do {
        const r = await db.send(new QueryCommand({
          TableName: "Submissions",
          KeyConditionExpression: "email = :e",
          ExpressionAttributeValues: marshall({ ":e": email }),
          ExclusiveStartKey: lastKey,
        }));
        for (const item of r.Items || []) {
          const u = unmarshall(item);
          if (u.labID) submissionsByLab[u.labID] = u;
        }
        lastKey = r.LastEvaluatedKey;
      } while (lastKey);

      return {
        statusCode: 200,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ success: true, submissionsByLab })
      };
    }

    if(!email || !labID){
      return {
        statusCode: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ success: false, error: "email and labID required" })
      };
    }

    const res = await db.send(new GetItemCommand({
      TableName: "Submissions",
      Key: marshall({ email, labID })
    }));

    if(!res.Item){
      return {
        statusCode: 404,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ success: false, error: "submission not found" })
      };
    }

    const submission = unmarshall(res.Item);

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ success: true, submission })
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