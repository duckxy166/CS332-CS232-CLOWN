'use strict';
const { mockSend } = require('./helpers/setup');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { handler } = require('../src/backend/functions/image-access/index');

const makeEvent = (imageKey) => ({
  httpMethod: 'GET', pathParameters: imageKey ? { imageKey } : {},
});

describe('image-access', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns pre-signed URL', async () => {
    const body = JSON.parse((await handler(makeEvent('img.jpg'))).body);
    expect(body.data.url).toBe('https://presigned.example.com/image.jpg');
    expect(body.data.expiresIn).toBe(900);
  });

  test('calls getSignedUrl with 900s expiry', async () => {
    await handler(makeEvent('img.jpg'));
    expect(getSignedUrl).toHaveBeenCalledWith(expect.anything(), expect.anything(), { expiresIn: 900 });
  });

  test('missing imageKey returns 400', async () => {
    const res = await handler(makeEvent(null));
    expect(res.statusCode).toBe(400);
  });

  test('decodes URL-encoded imageKey', async () => {
    const res = await handler(makeEvent(encodeURIComponent('path/to/img.jpg')));
    expect(res.statusCode).toBe(200);
  });
});
