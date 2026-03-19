'use strict';

// Shared mock setup for all Lambda tests
// Mock AWS clients ที่ aws-config.js ต้องการ
jest.mock('@aws-sdk/client-dynamodb', () => ({ DynamoDBClient: jest.fn(() => ({})) }));
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(() => ({})),
  GetObjectCommand: jest.fn((params) => ({ type: 'GetObject', params })),
}));
jest.mock('@aws-sdk/client-rekognition', () => ({ RekognitionClient: jest.fn(() => ({})) }));
jest.mock('@aws-sdk/client-lambda', () => ({ LambdaClient: jest.fn(() => ({})) }));
jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://presigned.example.com/image.jpg'),
}));

// Mock DynamoDB DocumentClient — export send fn for test control
const mockSend = jest.fn();
jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: { from: jest.fn(() => ({ send: mockSend })) },
  QueryCommand: jest.fn((p) => ({ type: 'Query', ...p })),
  BatchGetCommand: jest.fn((p) => ({ type: 'BatchGet', ...p })),
  ScanCommand: jest.fn((p) => ({ type: 'Scan', ...p })),
  GetCommand: jest.fn((p) => ({ type: 'Get', ...p })),
  PutCommand: jest.fn((p) => ({ type: 'Put', ...p })),
  UpdateCommand: jest.fn((p) => ({ type: 'Update', ...p })),
}));

module.exports = { mockSend };
