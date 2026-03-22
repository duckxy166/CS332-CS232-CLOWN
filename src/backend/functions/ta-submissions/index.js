const { ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { dynamoClient, SUBMISSIONS_TABLE } = require('../../config/aws-config');
const { response, ok, error } = require('../../utils/response');

const VALID_STATUSES = ['pending', 'ai_pass', 'ai_fail', 'graded'];

function buildStats(items) {
  const stats = { total: 0, pending: 0, ai_pass: 0, ai_fail: 0, graded: 0 };
  for (const item of items) {
    stats.total++;
    const s = item.status || 'pending';
    if (s in stats) stats[s]++;
  }
  return stats;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return response(200, {});

  try {
    const { courseId, labId } = event.pathParameters || {};
    if (!courseId || !labId) return error(400, 'กรุณาระบุ courseId และ labId');

    const { status: filterStatus, sort = 'date_desc' } = event.queryStringParameters || {};
    if (filterStatus && !VALID_STATUSES.includes(filterStatus)) {
      return error(400, `status ไม่ถูกต้อง ใช้ได้: ${VALID_STATUSES.join(', ')}`);
    }

    const scanResult = await dynamoClient.send(new ScanCommand({
      TableName: SUBMISSIONS_TABLE,
      FilterExpression: 'courseId = :cid AND labId = :lid',
      ExpressionAttributeValues: { ':cid': courseId, ':lid': labId },
    }));

    let items = scanResult.Items || [];
    const stats = buildStats(items);

    if (filterStatus) {
      items = items.filter((i) => (i.status || 'pending') === filterStatus);
    }

    items.sort((a, b) => {
      const ta = new Date(a.submittedAt || 0).getTime();
      const tb = new Date(b.submittedAt || 0).getTime();
      return sort === 'date_asc' ? ta - tb : tb - ta;
    });

    const submissions = items.map((item) => ({
      submissionId: item.submissionId, studentId: item.studentId,
      submittedAt: item.submittedAt, status: item.status || 'pending',
      aiScore: item.aiScore ?? null, taGrade: item.taGrade ?? null,
    }));

    return ok({ submissions, stats });
  } catch (err) {
    console.error('ta-submissions error:', err);
    return error(500, 'เกิดข้อผิดพลาดภายในระบบ');
  }
};
