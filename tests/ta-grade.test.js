'use strict';
const { mockSend } = require('./helpers/setup');
const { handler } = require('../src/backend/functions/ta-grade/index');

const makeEvent = (overrides = {}) => ({
  httpMethod: 'PUT', pathParameters: { submissionId: 'sub123' },
  body: JSON.stringify({ grade: 85, feedback: 'Good work' }), ...overrides,
});

const existingItem = { submissionId: 'sub123', studentId: 's1', status: 'ai_pass' };

describe('ta-grade', () => {
  beforeEach(() => jest.clearAllMocks());

  test('missing submissionId returns 400', async () => {
    const res = await handler(makeEvent({ pathParameters: {} }));
    expect(res.statusCode).toBe(400);
  });

  test('valid grade updates and returns 200', async () => {
    mockSend.mockResolvedValueOnce({ Item: existingItem }).mockResolvedValueOnce({});
    const body = JSON.parse((await handler(makeEvent())).body);
    expect(body.success).toBe(true);
    expect(body.data.taGrade).toBe(85);
    expect(body.data.status).toBe('graded');
  });

  test('grade out of range returns 400', async () => {
    const res = await handler(makeEvent({ body: JSON.stringify({ grade: 101, feedback: 'x' }) }));
    expect(res.statusCode).toBe(400);
  });

  test('empty feedback returns 400', async () => {
    const res = await handler(makeEvent({ body: JSON.stringify({ grade: 80, feedback: '' }) }));
    expect(res.statusCode).toBe(400);
  });

  test('missing grade returns 400', async () => {
    const res = await handler(makeEvent({ body: JSON.stringify({ feedback: 'Good' }) }));
    expect(res.statusCode).toBe(400);
  });

  test('submission not found returns 404', async () => {
    mockSend.mockResolvedValueOnce({ Item: undefined });
    const res = await handler(makeEvent());
    expect(res.statusCode).toBe(404);
  });
});
