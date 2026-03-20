'use strict';
const { mockSend } = require('./helpers/setup');
const { handler } = require('../src/backend/functions/get-submissions/index');

const makeEvent = (overrides = {}) => ({
  httpMethod: 'GET', pathParameters: {}, queryStringParameters: null, ...overrides,
});

describe('get-submissions', () => {
  beforeEach(() => jest.clearAllMocks());

  test('OPTIONS returns 200', async () => {
    const res = await handler(makeEvent({ httpMethod: 'OPTIONS' }));
    expect(res.statusCode).toBe(200);
  });

  test('missing studentId returns 400', async () => {
    const res = await handler(makeEvent());
    expect(res.statusCode).toBe(400);
  });

  test('list submissions with labName', async () => {
    mockSend
      .mockResolvedValueOnce({ Items: [{ submissionId: 's1#lab1', studentId: 's1', courseId: 'c1', labId: 'lab1', status: 'pending', submittedAt: '2026-03-01T00:00:00Z' }], LastEvaluatedKey: null })
      .mockResolvedValueOnce({ Responses: { Labs: [{ courseId: 'c1', labId: 'lab1', labName: 'Lab 1' }] } });

    const res = await handler(makeEvent({ pathParameters: { studentId: 's1' } }));
    const body = JSON.parse(res.body);
    expect(res.statusCode).toBe(200);
    expect(body.data.submissions).toHaveLength(1);
    expect(body.data.submissions[0].labName).toBe('Lab 1');
    expect(body.data.nextKey).toBeNull();
  });

  test('pagination returns nextKey', async () => {
    mockSend
      .mockResolvedValueOnce({ Items: [{ submissionId: 's1#lab1', studentId: 's1', courseId: 'c1', labId: 'lab1' }], LastEvaluatedKey: { submissionId: 's1#lab1' } })
      .mockResolvedValueOnce({ Responses: { Labs: [] } });

    const body = JSON.parse((await handler(makeEvent({ pathParameters: { studentId: 's1' } }))).body);
    expect(body.data.nextKey).not.toBeNull();
  });

  test('detail returns submission with imageUrl', async () => {
    mockSend.mockResolvedValueOnce({ Items: [{ submissionId: 's1#lab1', studentId: 's1', courseId: 'c1', labId: 'lab1', status: 'graded', imageKey: 'img.jpg', taGrade: 85 }] });

    const res = await handler(makeEvent({ pathParameters: { studentId: 's1', labId: 'lab1' } }));
    const body = JSON.parse(res.body);
    expect(body.data.imageUrl).toBe('https://presigned.example.com/image.jpg');
    expect(body.data.taGrade).toBe(85);
  });

  test('detail not found returns 404', async () => {
    mockSend.mockResolvedValueOnce({ Items: [] });
    const res = await handler(makeEvent({ pathParameters: { studentId: 's1', labId: 'lab99' } }));
    expect(res.statusCode).toBe(404);
  });

  test('invalid lastKey returns 400', async () => {
    const res = await handler(makeEvent({ pathParameters: { studentId: 's1' }, queryStringParameters: { lastKey: '!!invalid!!' } }));
    expect(res.statusCode).toBe(400);
  });
});
