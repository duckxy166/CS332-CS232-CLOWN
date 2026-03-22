import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";
import { randomUUID } from "crypto";

const db = new DynamoDBClient({ region: "us-east-1" });

export const handler = async (event) => {

  try {
    /* ── รับข้อมูลจาก frontend ── */
    const body = JSON.parse(event.body || event);

    const labID = randomUUID();

    const item = {
      labID,
      labName:     body.labName,
      subjectId:   body.subjectId,
      sections:    body.sections,
      description: body.description || "",
      deadline:    body.deadline,
      images:      body.images,
      rules:       body.rules,
      thresholds:  body.thresholds,
      createdBy:   body.createdBy || "TA",
      status:      "active",
      createdAt:   new Date().toISOString()
    };

    await db.send(new PutItemCommand({
      TableName: "Labs",
      Item: marshall(item)
    }));

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ success: true, labID })
    };

  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ success: false, error: err.message })
    };
  }
};