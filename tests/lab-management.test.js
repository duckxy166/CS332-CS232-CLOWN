'use strict';
const { mockSend } = require('./helpers/setup');
const { handler } = require('../src/backend/functions/lab-management/index');

const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
const pastDate = new Date(Date.now() - 1000).toISOString();

const makeEvent = (method, pathParams, body = null, queryParams = null, resource = '') => ({
  httpMethod: method, pathParameters: pathParams || {},
  body: body ? JSON.stringify(body) : null, queryStringParameters: queryParams, resource,
});

describe('lab-management', () => {
  beforeEach(() => jest.clearAllMocks());

  test('GET /labs/{courseId} lists labs', async () => {
    mockSend.mockResolvedValueOnce({ Items: [{ courseId: 'c1', labId: 'lab_1', labName: 'Lab 1', deadline: futureDate }] });
    const body = JSON.parse((await handler(makeEvent('GET', { courseId: 'c1' }))).body);
    expect(body.data.labs).toHaveLength(1);
    expect(body.data.labs[0].labName).toBe('Lab 1');
  });

  test('POST /labs creates lab', async () => {
    mockSend.mockResolvedValueOnce({});
    const res = await handler(makeEvent('POST', {}, { labName: 'Lab 1', courseId: 'c1', deadline: futureDate, requiredImages: 3 }));
    expect(res.statusCode).toBe(201);
    expect(JSON.parse(res.body).data.labId).toMatch(/^lab_\d+$/);
  });

  test('POST with past deadline returns 400', async () => {
    const res = await handler(makeEvent('POST', {}, { labName: 'Lab', courseId: 'c1', deadline: pastDate }));
    expect(res.statusCode).toBe(400);
  });

  test('POST missing labName returns 400', async () => {
    const res = await handler(makeEvent('POST', {}, { courseId: 'c1', deadline: futureDate }));
    expect(res.statusCode).toBe(400);
  });

  test('PUT /labs/{labId} updates', async () => {
    mockSend.mockResolvedValueOnce({ Item: { courseId: 'c1', labId: 'lab_1' } }).mockResolvedValueOnce({});
    const res = await handler(makeEvent('PUT', { labId: 'lab_1' }, { courseId: 'c1', deadline: futureDate }));
    expect(res.statusCode).toBe(200);
  });

  test('PUT not found returns 404', async () => {
    mockSend.mockResolvedValueOnce({ Item: undefined });
    const res = await handler(makeEvent('PUT', { labId: 'lab_x' }, { courseId: 'c1' }));
    expect(res.statusCode).toBe(404);
  });

  test('GET stats returns correct counts', async () => {
    mockSend
      .mockResolvedValueOnce({ Item: { courseId: 'c1', labId: 'lab_1', labName: 'Lab 1', deadline: futureDate } })
      .mockResolvedValueOnce({ Items: [
        { status: 'pending' },
        { status: 'graded', aiScore: 80, taGrade: 85 },
      ] });

    const body = JSON.parse((await handler(makeEvent('GET', { labId: 'lab_1' }, null, { courseId: 'c1', action: 'stats' }, '/labs/{labId}/stats'))).body);
    expect(body.data.stats.total).toBe(2);
    expect(body.data.stats.graded).toBe(1);
    expect(body.data.stats.avgTaGrade).toBe(85);
  });
});
