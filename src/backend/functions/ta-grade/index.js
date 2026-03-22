const { GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { dynamoClient, SUBMISSIONS_TABLE } = require('../../config/aws-config');
const { response, ok, error } = require('../../utils/response');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return response(200, {});

  try {
    const { submissionId } = event.pathParameters || {};
    if (!submissionId) return error(400, 'กรุณาระบุ submissionId');

    const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    const { grade, feedback } = body || {};

    if (grade === undefined || grade === null) return error(400, 'กรุณาระบุ grade');
    const gradeNum = Number(grade);
    if (!Number.isFinite(gradeNum) || gradeNum < 0 || gradeNum > 100) {
      return error(400, 'grade ต้องเป็นตัวเลขระหว่าง 0 ถึง 100');
    }
    if (!feedback || feedback.trim() === '') return error(400, 'กรุณาใส่ feedback');

    const existing = await dynamoClient.send(new GetCommand({
      TableName: SUBMISSIONS_TABLE, Key: { submissionId },
    }));
    if (!existing.Item) return error(404, 'ไม่พบ submission ที่ระบุ');

    const gradedAt = new Date().toISOString();
    await dynamoClient.send(new UpdateCommand({
      TableName: SUBMISSIONS_TABLE,
      Key: { submissionId },
      UpdateExpression: 'SET taGrade = :grade, taFeedback = :fb, #s = :status, gradedAt = :at',
      ExpressionAttributeNames: { '#s': 'status' },
      ExpressionAttributeValues: {
        ':grade': gradeNum, ':fb': feedback.trim(),
        ':status': 'graded', ':at': gradedAt,
      },
    }));

    return ok({ submissionId, taGrade: gradeNum, status: 'graded', gradedAt }, 'ให้คะแนนสำเร็จ');
  } catch (err) {
    console.error('ta-grade error:', err);
    return error(500, 'เกิดข้อผิดพลาดภายในระบบ');
  }
};
