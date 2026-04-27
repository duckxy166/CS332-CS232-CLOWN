import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";
import { randomUUID } from "crypto";

const db = new DynamoDBClient({ region: "us-east-1" });

export const handler = async (event) => {

  try {
    /* ── parse body ── */
    let body;
    if (typeof event.body === 'string') {
      body = JSON.parse(event.body);
    } else if (event.body !== undefined) {
      body = event.body;
    } else {
      body = event;
    }

    console.log('body received:', JSON.stringify({
      labID: body.labID,
      enableLLMCheck: body.enableLLMCheck,
      imageCount: body.images?.length,
    }));
    console.log('[labConfig] images with llmDescription:', JSON.stringify(
      body.images?.map(i => ({ id: i.id, hasLLM: !!i.llmDescription }))
    ));

    const labID = body.labID || randomUUID();

    // Strip base64 image data — store only slot/s3Key metadata + AI fields in DynamoDB
    const images = (body.images || []).map(({ id, slot, s3Key, refS3Key, llmDescription }) => ({
      id,
      slot,
      s3Key,
      refS3Key: refS3Key || s3Key || null,
      llmDescription: llmDescription || null,
    }));

    const item = {
      labID,
      labName:        body.labName,
      subjectId:      body.subjectId,
      sections:       body.sections,
      description:    body.description || "",
      deadline:       body.deadline,
      images,
      rules:          body.rules,
      thresholds:     body.thresholds,
      enableLLMCheck: body.enableLLMCheck === true,
      createdBy:      body.createdBy || "TA",
      status:         "active",
      createdAt:      new Date().toISOString()
    };

    await db.send(new PutItemCommand({
      TableName: "Labs",
      Item: marshall(item, { removeUndefinedValues: true })
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