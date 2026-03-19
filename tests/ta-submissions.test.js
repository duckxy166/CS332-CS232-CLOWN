'use strict';
const { mockSend } = require('./helpers/setup');
const { handler } = require('../src/backend/functions/ta-submissions/index');

const makeEvent = (overrides = {}) => ({
  httpMethod: 'GET', pathParameters: { courseId: 'c1', labId: 'lab1' }, queryStringParameters: null, ...overrides,
});

const sampleItems = [
  { submissionId: 's1', studentId: 's1', status: 'pending', submittedAt: '2026-03-01T10:00:00Z' },
  { submissionId: 's2', studentId: 's2', status: 'ai_pass', submittedAt: '2026-03-01T09:00:00Z', aiScore: 90 },
  { submissionId: 's3', studentId: 's3', status: 'graded', submittedAt: '2026-03-01T08:00:00Z', taGrade: 85 },
];

describe('ta-submissions', () => {
  beforeEach(() => jest.clearAllMocks());

  test('missing params returns 400', async () => {
    const res = await handler(makeEvent({ pathParameters: {} }));
    expect(res.statusCode).toBe(400);
  });

  test('returns submissions with stats', async () => {
    mockSend.mockResolvedValueOnce({ Items: sampleItems });
    const body = JSON.parse((await handler(makeEvent())).body);
    expect(body.data.submissions).toHaveLength(3);
    expect(body.data.stats).toEqual({ total: 3, pending: 1, ai_pass: 1, ai_fail: 0, graded: 1 });
  });

  test('filter by status', async () => {
    mockSend.mockResolvedValueOnce({ Items: sampleItems });
    const body = JSON.parse((await handler(makeEvent({ queryStringParameters: { status: 'pending' } }))).body);
    expect(body.data.submissions).toHaveLength(1);
    expect(body.data.stats.total).toBe(3); // stats ยังนับทั้งหมด
  });

  test('invalid status returns 400', async () => {
    const res = await handler(makeEvent({ queryStringParameters: { status: 'xxx' } }));
    expect(res.statusCode).toBe(400);
  });

  test('default sort is date_desc', async () => {
    mockSend.mockResolvedValueOnce({ Items: sampleItems });
    const body = JSON.parse((await handler(makeEvent())).body);
    const dates = body.data.submissions.map((s) => s.submittedAt);
    expect(new Date(dates[0]) >= new Date(dates[1])).toBe(true);
  });

  test('empty lab returns zero stats', async () => {
    mockSend.mockResolvedValueOnce({ Items: [] });
    const body = JSON.parse((await handler(makeEvent())).body);
    expect(body.data.submissions).toHaveLength(0);
    expect(body.data.stats.total).toBe(0);
  });
});
