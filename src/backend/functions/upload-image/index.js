
//* Lambda: upload-image

const { PutObjectCommand } = require('@aws-sdk/client-s3');
const { s3Client, BUCKET_NAME } = require('../../config/aws-config');
const { randomUUID } = require('crypto');

exports.handler = async (event) => {
  try {
    const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    const { imageBase64, contentType = 'image/jpeg', userId = 'anonymous' } = body;

    if (!imageBase64) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'imageBase64 is required' }),
      };
    }

    const buffer = Buffer.from(imageBase64, 'base64');
    const ext = contentType === 'image/png' ? 'png' : 'jpg';
    const key = `uploads/${userId}/${randomUUID()}.${ext}`;

    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }));

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ key, bucket: BUCKET_NAME }),
    };
  } catch (error) {
    console.error('upload-image error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
