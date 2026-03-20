const { GetCommand, PutCommand, UpdateCommand, QueryCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { dynamoClient, SUBMISSIONS_TABLE, LABS_TABLE } = require('../../config/aws-config');
const { response, ok, created, error } = require('../../utils/response');

async function listLabs(courseId) {
  const result = await dynamoClient.send(new QueryCommand({
    TableName: LABS_TABLE,
    KeyConditionExpression: 'courseId = :cid',
    ExpressionAttributeValues: { ':cid': courseId },
  }));

  const labs = (result.Items || []).map((lab) => ({
    courseId: lab.courseId, labId: lab.labId,
    labName: lab.labName || null, deadline: lab.deadline,
    requiredImages: lab.requiredImages ?? null, createdAt: lab.createdAt ?? null,
  }));
  return ok({ labs });
}

async function createLab(body) {
  const { labName, courseId, deadline, requiredImages } = body || {};
  if (!labName || labName.trim() === '') return error(400, 'กรุณาระบุ labName');
  if (!courseId || courseId.trim() === '') return error(400, 'กรุณาระบุ courseId');
  if (!deadline) return error(400, 'กรุณาระบุ deadline');
  if (new Date(deadline).getTime() <= Date.now()) return error(400, 'deadline ต้องเป็นเวลาในอนาคต');

  const labId = `lab_${Date.now()}`;
  const createdAt = new Date().toISOString();
  await dynamoClient.send(new PutCommand({
    TableName: LABS_TABLE,
    Item: { courseId: courseId.trim(), labId, labName: labName.trim(), deadline, requiredImages: requiredImages ?? null, createdAt },
  }));

  return created({ courseId, labId, labName, deadline, requiredImages, createdAt }, 'สร้าง Lab สำเร็จ');
}

async function updateLab(labId, body) {
  const { courseId, deadline, requiredImages } = body || {};
  if (!courseId) return error(400, 'กรุณาระบุ courseId ใน body');

  const existing = await dynamoClient.send(new GetCommand({
    TableName: LABS_TABLE, Key: { courseId: courseId.trim(), labId },
  }));
  if (!existing.Item) return error(404, 'ไม่พบ Lab ที่ระบุ');
  if (deadline && new Date(deadline).getTime() <= Date.now()) return error(400, 'deadline ต้องเป็นเวลาในอนาคต');

  const parts = ['updatedAt = :updatedAt'];
  const values = { ':updatedAt': new Date().toISOString() };
  if (deadline) { parts.push('deadline = :deadline'); values[':deadline'] = deadline; }
  if (requiredImages !== undefined) { parts.push('requiredImages = :ri'); values[':ri'] = requiredImages; }

  await dynamoClient.send(new UpdateCommand({
    TableName: LABS_TABLE,
    Key: { courseId: courseId.trim(), labId },
    UpdateExpression: `SET ${parts.join(', ')}`,
    ExpressionAttributeValues: values,
  }));

  return ok({ courseId, labId, deadline, requiredImages }, 'อัปเดต Lab สำเร็จ');
}

async function getLabStats(labId, courseId) {
  if (!courseId) return error(400, 'กรุณาระบุ courseId ใน query string');

  const labResult = await dynamoClient.send(new GetCommand({ TableName: LABS_TABLE, Key: { courseId, labId } }));
  if (!labResult.Item) return error(404, 'ไม่พบ Lab ที่ระบุ');

  const scanResult = await dynamoClient.send(new ScanCommand({
    TableName: SUBMISSIONS_TABLE,
    FilterExpression: 'courseId = :cid AND labId = :lid',
    ExpressionAttributeValues: { ':cid': courseId, ':lid': labId },
  }));

  const items = scanResult.Items || [];
  const stats = { total: items.length, pending: 0, ai_pass: 0, ai_fail: 0, graded: 0 };
  let aiSum = 0, aiCount = 0, taSum = 0, taCount = 0;

  for (const item of items) {
    const s = item.status || 'pending';
    if (s in stats) stats[s]++;
    if (item.aiScore != null) { aiSum += item.aiScore; aiCount++; }
    if (item.taGrade != null) { taSum += item.taGrade; taCount++; }
  }

  return ok({
    courseId, labId, labName: labResult.Item.labName || null, deadline: labResult.Item.deadline,
    stats: { ...stats, avgAiScore: aiCount ? +(aiSum / aiCount).toFixed(2) : null, avgTaGrade: taCount ? +(taSum / taCount).toFixed(2) : null },
  });
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return response(200, {});

  try {
    const method = event.httpMethod;
    const { courseId, labId } = event.pathParameters || {};
    const body = event.body ? (typeof event.body === 'string' ? JSON.parse(event.body) : event.body) : {};

    if (method === 'POST') return await createLab(body);
    if (method === 'PUT' && labId) return await updateLab(labId, body);

    if (method === 'GET') {
      const isStats = event.resource?.endsWith('/stats') || event.queryStringParameters?.action === 'stats';
      if (isStats && labId) return await getLabStats(labId, event.queryStringParameters?.courseId);
      if (courseId) return await listLabs(courseId);
      return error(400, 'กรุณาระบุ courseId');
    }

    return error(405, 'Method ไม่รองรับ');
  } catch (err) {
    console.error('lab-management error:', err);
    return error(500, 'เกิดข้อผิดพลาดภายในระบบ');
  }
};
