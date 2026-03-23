//* AWS SDK Configuration

const { S3Client } = require('@aws-sdk/client-s3');
const { TextractClient } = require('@aws-sdk/client-textract');
const { SQSClient } = require('@aws-sdk/client-sqs');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
const { LambdaClient } = require('@aws-sdk/client-lambda');

const REGION = process.env.AWS_REGION || 'us-east-1';
const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'your-bucket-name';
const SCREENSHOT_BUCKET = process.env.SCREENSHOT_BUCKET || 'lab-checker-screenshots';
const REFERENCE_BUCKET = process.env.REFERENCE_BUCKET || 'lab-checker-reference';
const SUBMISSIONS_TABLE = process.env.SUBMISSIONS_TABLE || 'Submissions';
const LABS_TABLE = process.env.LABS_TABLE || 'Labs';
const QUEUE_URL = process.env.QUEUE_URL || '';

const s3Client = new S3Client({ region: REGION });
const textractClient = new TextractClient({ region: REGION });
const sqsClient = new SQSClient({ region: REGION });
const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));
const lambdaClient = new LambdaClient({ region: REGION });

module.exports = {
  s3Client,
  textractClient,
  sqsClient,
  dynamoClient,
  lambdaClient,
  BUCKET_NAME,
  SCREENSHOT_BUCKET,
  REFERENCE_BUCKET,
  SUBMISSIONS_TABLE,
  LABS_TABLE,
  QUEUE_URL,
};