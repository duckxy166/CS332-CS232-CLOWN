//* AWS SDK Configuration

const { S3Client } = require('@aws-sdk/client-s3');
const { RekognitionClient } = require('@aws-sdk/client-rekognition');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
const { LambdaClient } = require('@aws-sdk/client-lambda');

const REGION = process.env.AWS_REGION || 'us-east-1';
const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'your-bucket-name';
const SUBMISSIONS_TABLE = process.env.SUBMISSIONS_TABLE || 'Submissions';
const LABS_TABLE = process.env.LABS_TABLE || 'Labs';
const VALIDATE_FUNCTION = process.env.VALIDATE_FUNCTION || 'validate-image';

const s3Client = new S3Client({ region: REGION });
const rekognitionClient = new RekognitionClient({ region: REGION });
const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));
const lambdaClient = new LambdaClient({ region: REGION });

module.exports = {
  s3Client,
  rekognitionClient,
  dynamoClient,
  lambdaClient,
  BUCKET_NAME,
  SUBMISSIONS_TABLE,
  LABS_TABLE,
  VALIDATE_FUNCTION,
};