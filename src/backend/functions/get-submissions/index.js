const { GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { QueryCommand, BatchGetCommand } = require('@aws-sdk/lib-dynamodb');
const { s3Client, dynamoClient, BUCKET_NAME, SUBMISSIONS_TABLE, LABS_TABLE } = require('../../config/aws-config');
const { response, ok, error } = require('../../utils/response');

const PRESIGNED_URL_EXPIRY = 900;

async function getStudentSubmissions(studentId, queryParams) {
  const limit = Math.min(parseInt(queryParams?.limit) || 20, 100);
  let exclusiveStartKey;
  if (queryParams?.lastKey) {
    try {
      exclusiveStartKey = JSON.parse(Buffer.from(queryParams.lastKey, 'base64').toString('utf8'));
    } catch {
      return error(400, 'lastKey ไม่ถูกต้อง');
    }
  }

  const params = {
    TableName: SUBMISSIONS_TABLE,
    IndexName: 'studentId-labId-index',
    KeyConditionExpression: 'studentId = :sid',
    ExpressionAttributeValues: { ':sid': studentId },
    Limit: limit,
  };
  if (exclusiveStartKey) params.ExclusiveStartKey = exclusiveStartKey;

  const result = await dynamoClient.send(new QueryCommand(params));
  const items = result.Items || [];

  // batch-get labName จาก LABS_TABLE
  let labNames = {};
  if (items.length > 0) {
    const uniqueKeys = [...new Map(items.map((i) => [`${i.courseId}#${i.labId}`, { courseId: i.courseId, labId: i.labId }])).values()];
    try {
      const batch = await dynamoClient.send(new BatchGetCommand({
        RequestItems: { [LABS_TABLE]: { Keys: uniqueKeys, ProjectionExpression: 'courseId, labId, labName' } },
      }));
      (batch.Responses?.[LABS_TABLE] || []).forEach((lab) => {
        labNames[`${lab.courseId}#${lab.labId}`] = lab.labName || null;
      });
    } catch { /* labName ไม่ critical */ }
  }

  const submissions = items.map((item) => ({
    submissionId: item.submissionId,
    labId: item.labId,
    courseId: item.courseId,
    labName: labNames[`${item.courseId}#${item.labId}`] || null,
    status: item.status || 'pending',
    submittedAt: item.submittedAt,
    aiScore: item.aiScore ?? null,
    taGrade: item.taGrade ?? null,
  }));

  const nextKey = result.LastEvaluatedKey
    ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
    : null;

  return ok({ submissions, nextKey });
}

async function getSubmissionDetail(studentId, labId) {
  const result = await dynamoClient.send(new QueryCommand({
    TableName: SUBMISSIONS_TABLE,
    IndexName: 'studentId-labId-index',
    KeyConditionExpression: 'studentId = :sid AND labId = :lid',
    ExpressionAttributeValues: { ':sid': studentId, ':lid': labId },
    Limit: 1,
  }));

  const item = result.Items?.[0];
  if (!item) return error(404, 'ไม่พบข้อมูลการส่งงานสำหรับ lab นี้');

  let imageUrl = null;
  if (item.imageKey) {
    try {
      imageUrl = await getSignedUrl(s3Client, new GetObjectCommand({ Bucket: BUCKET_NAME, Key: item.imageKey }), { expiresIn: PRESIGNED_URL_EXPIRY });
    } catch { /* ปล่อย null */ }
  }

  return ok({
    submissionId: item.submissionId, studentId: item.studentId,
    labId: item.labId, courseId: item.courseId,
    status: item.status || 'pending', submittedAt: item.submittedAt,
    imageKey: item.imageKey || null, imageUrl,
    aiResult: item.aiResult ?? null, aiScore: item.aiScore ?? null,
    taFeedback: item.taFeedback ?? null, taGrade: item.taGrade ?? null,
    gradedAt: item.gradedAt ?? null,
  });
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return response(200, {});

  try {
    const { studentId, labId } = event.pathParameters || {};
    if (!studentId) return error(400, 'กรุณาระบุ studentId');

    return labId
      ? await getSubmissionDetail(studentId, labId)
      : await getStudentSubmissions(studentId, event.queryStringParameters);
  } catch (err) {
    console.error('get-submissions error:', err);
    return error(500, 'เกิดข้อผิดพลาดภายในระบบ');
  }
};
