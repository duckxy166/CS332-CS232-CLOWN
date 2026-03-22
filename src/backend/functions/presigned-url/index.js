//* Lambda: presigned-url
//* Generate pre-signed URL สำหรับ upload หรือ download รูปภาพจาก S3

const { GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { s3Client, BUCKET_NAME } = require('../../config/aws-config');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
};

const URL_EXPIRY = 3600; // 1 ชั่วโมง
const ALLOWED_TYPES = ['image/jpeg', 'image/png'];

function response(statusCode, body) {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return response(200, {});
  }

  try {
    const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    const { action, key, contentType } = body;

    if (!action || !key) {
      return response(400, { success: false, message: 'กรุณาระบุ action (upload/download) และ key' });
    }

    let url;

    if (action === 'download') {
      // Pre-signed URL สำหรับดาวน์โหลด/ดูรูป
      url = await getSignedUrl(
        s3Client,
        new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key }),
        { expiresIn: URL_EXPIRY },
      );
    } else if (action === 'upload') {
      // Pre-signed URL สำหรับอัปโหลดตรงไป S3 (ไม่ผ่าน Lambda)
      if (!contentType || !ALLOWED_TYPES.includes(contentType)) {
        return response(400, { success: false, message: 'ประเภทไฟล์ไม่ถูกต้อง รองรับเฉพาะ JPG และ PNG' });
      }

      url = await getSignedUrl(
        s3Client,
        new PutObjectCommand({ Bucket: BUCKET_NAME, Key: key, ContentType: contentType }),
        { expiresIn: URL_EXPIRY },
      );
    } else {
      return response(400, { success: false, message: 'action ต้องเป็น upload หรือ download' });
    }

    return response(200, {
      success: true,
      message: 'สร้าง URL สำเร็จ',
      data: { url, expiresIn: URL_EXPIRY },
    });

  } catch (error) {
    console.error('presigned-url error:', error);
    return response(500, { success: false, message: 'เกิดข้อผิดพลาดในการสร้าง URL' });
  }
};
