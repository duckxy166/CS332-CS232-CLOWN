import { DynamoDBClient, GetItemCommand } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";

const db = new DynamoDBClient({ region: "us-east-1" });

export const handler = async (event) => {
  try {
    let body = typeof event.body === 'string' ? JSON.parse(event.body) : (event.body ?? event);

    const email = event.queryStringParameters?.email || body.email;
    const labID = event.queryStringParameters?.labID || body.labID;

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