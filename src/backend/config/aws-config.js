//* AWS SDK Configuration

const { S3Client } = require('@aws-sdk/client-s3');
const { RekognitionClient } = require('@aws-sdk/client-rekognition');

const REGION = process.env.AWS_REGION || 'us-east-1';
const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'your-bucket-name';

const s3Client = new S3Client({ region: REGION });
const rekognitionClient = new RekognitionClient({ region: REGION });

module.exports = { s3Client, rekognitionClient, BUCKET_NAME };