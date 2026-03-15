// * Lambda: validate-image

const { DetectLabelsCommand } = require('@aws-sdk/client-rekognition');
const { rekognitionClient, BUCKET_NAME } = require('../../config/aws-config');

exports.handler = async (event) => {
  try {
    const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    const { key, bucket = BUCKET_NAME } = body;

    if (!key) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'key is required' }),
      };
    }

    const command = new DetectLabelsCommand({
      Image: {
        S3Object: { Bucket: bucket, Name: key },
      },
      MaxLabels: 10,
      MinConfidence: 70,
    });

    const response = await rekognitionClient.send(command);

    const labels = response.Labels.map((label) => ({
      name: label.Name,
      confidence: parseFloat(label.Confidence.toFixed(2)),
    }));

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ key, labels }),
    };
  } catch (error) {
    console.error('validate-image error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
