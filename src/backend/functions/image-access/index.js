const { GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { s3Client, BUCKET_NAME } = require('../../config/aws-config');
const { response, ok, error } = require('../../utils/response');

const URL_EXPIRY = 900;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return response(200, {});

  try {
    const rawKey = event.pathParameters?.imageKey;
    if (!rawKey) return error(400, 'กรุณาระบุ imageKey');

    const imageKey = decodeURIComponent(rawKey);
    const url = await getSignedUrl(s3Client, new GetObjectCommand({ Bucket: BUCKET_NAME, Key: imageKey }), { expiresIn: URL_EXPIRY });

    return ok({ url, expiresIn: URL_EXPIRY });
  } catch (err) {
    console.error('image-access error:', err);
    return error(500, 'เกิดข้อผิดพลาดในการสร้าง URL');
  }
};
