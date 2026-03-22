//* Lambda: upload-image
//* Handles image upload with pre-validation, S3 storage, DynamoDB metadata, and AI trigger

const { PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { GetCommand, PutCommand, UpdateCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { InvokeCommand } = require('@aws-sdk/client-lambda');
const { createHash } = require('crypto');
const {
  s3Client,
  dynamoClient,
  lambdaClient,
  BUCKET_NAME,
  SUBMISSIONS_TABLE,
  LABS_TABLE,
  VALIDATE_FUNCTION,
} = require('../../config/aws-config');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
};

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MIN_WIDTH = 800;
const MIN_HEIGHT = 600;
const ALLOWED_TYPES = ['image/jpeg', 'image/png'];

// --- Helpers ---

function response(statusCode, body) {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
  };
}

function successResponse(data) {
  return response(200, { success: true, message: 'อัปโหลดสำเร็จ', data });
}

function errorResponse(statusCode, message) {
  return response(statusCode, { success: false, message });
}

/** Parse image dimensions from raw buffer (JPEG / PNG) */
function getImageDimensions(buffer) {
  // PNG: bytes 0-7 = signature, IHDR chunk starts at byte 8
  // Width at offset 16 (4 bytes BE), Height at offset 20 (4 bytes BE)
  if (buffer[0] === 0x89 && buffer[1] === 0x50) {
    return {
      width: buffer.readUInt32BE(16),
      height: buffer.readUInt32BE(20),
    };
  }

  // JPEG: scan for SOF0 (0xFFC0) or SOF2 (0xFFC2) marker
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset < buffer.length - 9) {
      if (buffer[offset] !== 0xff) break;
      const marker = buffer[offset + 1];
      // SOF0 or SOF2
      if (marker === 0xc0 || marker === 0xc2) {
        return {
          height: buffer.readUInt16BE(offset + 5),
          width: buffer.readUInt16BE(offset + 7),
        };
      }
      // Skip to next marker
      const segmentLength = buffer.readUInt16BE(offset + 2);
      offset += 2 + segmentLength;
    }
  }

  return null;
}

/** Validate MIME type matches actual file bytes */
function detectMimeType(buffer) {
  if (buffer[0] === 0x89 && buffer[1] === 0x50) return 'image/png';
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return 'image/jpeg';
  return null;
}

/**
 * Parse multipart/form-data body จาก API Gateway
 * API Gateway ส่ง body มาเป็น base64 encoded เมื่อเป็น binary
 */
function parseMultipart(event) {
  const contentTypeHeader = event.headers?.['Content-Type'] || event.headers?.['content-type'] || '';
  const boundaryMatch = contentTypeHeader.match(/boundary=(.+)/);
  if (!boundaryMatch) return null;

  const boundary = boundaryMatch[1].trim();
  const rawBody = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64')
    : Buffer.from(event.body);

  const parts = {};
  const bodyStr = rawBody.toString('binary');
  const segments = bodyStr.split(`--${boundary}`).filter((s) => s && s !== '--\r\n' && s !== '--');

  for (const segment of segments) {
    const headerEnd = segment.indexOf('\r\n\r\n');
    if (headerEnd === -1) continue;

    const headerPart = segment.substring(0, headerEnd);
    const dataPart = segment.substring(headerEnd + 4).replace(/\r\n$/, '');

    const nameMatch = headerPart.match(/name="([^"]+)"/);
    if (!nameMatch) continue;
    const name = nameMatch[1];

    const filenameMatch = headerPart.match(/filename="([^"]+)"/);
    const contentTypeMatch = headerPart.match(/Content-Type:\s*(.+)/i);

    if (filenameMatch) {
      // File field → เก็บเป็น Buffer
      parts[name] = {
        filename: filenameMatch[1],
        contentType: contentTypeMatch ? contentTypeMatch[1].trim() : 'application/octet-stream',
        data: Buffer.from(dataPart, 'binary'),
      };
    } else {
      // Text field
      parts[name] = dataPart.trim();
    }
  }

  return parts;
}

/**
 * Extract input จาก event — รองรับทั้ง JSON (Base64) และ multipart/form-data
 * return { buffer, contentType, studentId, courseId, labId }
 */
function extractInput(event) {
  const contentTypeHeader = event.headers?.['Content-Type'] || event.headers?.['content-type'] || '';

  // --- Multipart/form-data ---
  if (contentTypeHeader.includes('multipart/form-data')) {
    const parts = parseMultipart(event);
    if (!parts || !parts.image) return { error: 'กรุณาแนบไฟล์รูปภาพในฟิลด์ "image"' };

    return {
      buffer: parts.image.data,
      contentType: parts.image.contentType,
      studentId: parts.studentId,
      courseId: parts.courseId,
      labId: parts.labId,
    };
  }

  // --- JSON (Base64) ---
  const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
  if (!body.imageBase64) return { error: 'กรุณากรอกข้อมูลให้ครบ: imageBase64, studentId, courseId, labId' };

  return {
    buffer: Buffer.from(body.imageBase64, 'base64'),
    contentType: body.contentType,
    studentId: body.studentId,
    courseId: body.courseId,
    labId: body.labId,
  };
}

// --- Main handler ---

exports.handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return response(200, {});
  }

  try {
    const input = extractInput(event);
    if (input.error) return errorResponse(400, input.error);

    const { buffer, studentId, courseId, labId } = input;

    // ---- 1. Required fields ----
    if (!studentId || !courseId || !labId) {
      return errorResponse(400, 'กรุณากรอกข้อมูลให้ครบ: studentId, courseId, labId');
    }

    // ---- 2. File type check (MIME type + magic bytes) ----
    const detectedType = detectMimeType(buffer);
    if (!ALLOWED_TYPES.includes(detectedType)) {
      return errorResponse(400, 'ประเภทไฟล์ไม่ถูกต้อง รองรับเฉพาะ JPG และ PNG เท่านั้น');
    }

    // ---- 3. File size check ----
    if (buffer.length > MAX_FILE_SIZE) {
      return errorResponse(400, `ไฟล์มีขนาดเกินกำหนด สูงสุด 5MB แต่ได้รับ ${(buffer.length / (1024 * 1024)).toFixed(2)}MB`);
    }

    // ---- 4. Resolution check ----
    const dimensions = getImageDimensions(buffer);
    if (!dimensions) {
      return errorResponse(400, 'ไม่สามารถอ่านขนาดรูปภาพได้');
    }
    if (dimensions.width < MIN_WIDTH || dimensions.height < MIN_HEIGHT) {
      return errorResponse(400, `ความละเอียดรูปต่ำเกินไป: ${dimensions.width}x${dimensions.height} ต้องการขั้นต่ำ ${MIN_WIDTH}x${MIN_HEIGHT}`);
    }

    // ---- 5. Deadline check ----
    const labResult = await dynamoClient.send(new GetCommand({
      TableName: LABS_TABLE,
      Key: { courseId, labId },
    }));

    if (!labResult.Item) {
      return errorResponse(404, 'ไม่พบแล็บที่ระบุ');
    }

    const deadline = new Date(labResult.Item.deadline);
    if (Date.now() > deadline.getTime()) {
      return errorResponse(403, `หมดเขตส่งงานแล้ว กำหนดส่งคือ: ${labResult.Item.deadline}`);
    }

    // ---- 6. Duplicate detection (SHA-256 hash) + check existing submission ----
    const imageHash = createHash('sha256').update(buffer).digest('hex');

    const existingSubmissions = await dynamoClient.send(new QueryCommand({
      TableName: SUBMISSIONS_TABLE,
      IndexName: 'studentId-labId-index',
      KeyConditionExpression: 'studentId = :sid AND labId = :lid',
      ExpressionAttributeValues: {
        ':sid': studentId,
        ':lid': labId,
      },
    }));

    const existingRecord = existingSubmissions.Items && existingSubmissions.Items[0];

    // ถ้ารูป hash ซ้ำกับที่เคยส่ง → reject
    if (existingRecord && existingRecord.imageHash === imageHash) {
      return errorResponse(409, 'ตรวจพบรูปภาพซ้ำ คุณเคยส่งรูปนี้ไปแล้ว');
    }

    // ---- 7. Upload to S3 ----
    const timestamp = Date.now();
    const ext = detectedType === 'image/png' ? 'png' : 'jpg';
    const imageKey = `submissions/${courseId}/${labId}/${studentId}/${timestamp}.${ext}`;

    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: imageKey,
      Body: buffer,
      ContentType: detectedType,
    }));

    // ---- 8. Save / Update metadata to DynamoDB ----
    let submissionId;

    try {
      if (existingRecord) {
        // Re-submission: update record เก่า
        submissionId = existingRecord.submissionId;
        await dynamoClient.send(new UpdateCommand({
          TableName: SUBMISSIONS_TABLE,
          Key: { submissionId },
          UpdateExpression: 'SET imageKey = :key, imageHash = :hash, #s = :status, submittedAt = :at, width = :w, height = :h, fileSize = :size',
          ExpressionAttributeNames: { '#s': 'status' },
          ExpressionAttributeValues: {
            ':key': imageKey,
            ':hash': imageHash,
            ':status': 'pending',
            ':at': new Date().toISOString(),
            ':w': dimensions.width,
            ':h': dimensions.height,
            ':size': buffer.length,
          },
        }));
      } else {
        // First submission: สร้าง record ใหม่
        submissionId = `${studentId}#${labId}#${timestamp}`;
        await dynamoClient.send(new PutCommand({
          TableName: SUBMISSIONS_TABLE,
          Item: {
            submissionId,
            studentId,
            courseId,
            labId,
            imageKey,
            imageHash,
            status: 'pending',
            submittedAt: new Date().toISOString(),
            width: dimensions.width,
            height: dimensions.height,
            fileSize: buffer.length,
          },
        }));
      }
    } catch (dbError) {
      // Rollback: ลบไฟล์จาก S3 ถ้า save metadata ล้มเหลว
      console.error('DynamoDB save failed, rolling back S3:', dbError);
      await s3Client.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: imageKey }));
      return errorResponse(500, 'บันทึกข้อมูลล้มเหลว กรุณาลองใหม่อีกครั้ง');
    }

    // ---- 9. Trigger AI Validation Lambda (async) ----
    try {
      await lambdaClient.send(new InvokeCommand({
        FunctionName: VALIDATE_FUNCTION,
        InvocationType: 'Event', // async — don't wait for result
        Payload: JSON.stringify({
          body: JSON.stringify({
            key: imageKey,
            bucket: BUCKET_NAME,
            submissionId,
            studentId,
            labId,
          }),
        }),
      }));
    } catch (lambdaError) {
      // ไม่ rollback — ไฟล์กับ metadata บันทึกแล้ว แค่ AI ยังไม่ได้ตรวจ
      console.error('AI trigger failed (submission saved):', lambdaError);
    }

    // ---- 10. Return success ----
    return successResponse({
      imageKey,
      submissionId,
    });

  } catch (error) {
    console.error('upload-image error:', error);

    // Retry-able S3 errors
    if (error.name === 'ServiceUnavailable' || error.name === 'SlowDown') {
      return errorResponse(503, 'ระบบจัดเก็บไฟล์ไม่พร้อมใช้งานชั่วคราว กรุณาลองใหม่');
    }

    return errorResponse(500, 'เกิดข้อผิดพลาดภายในระบบ กรุณาลองใหม่อีกครั้ง');
  }
};
