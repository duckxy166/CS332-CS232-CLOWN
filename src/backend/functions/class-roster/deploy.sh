#!/usr/bin/env bash
# deploy.sh — สร้าง + deploy Lambda class-roster และ API Gateway route
# รันจาก project root:  bash src/backend/functions/class-roster/deploy.sh
# ต้องมี AWS CLI และ credentials ที่มีสิทธิ์ lambda:*, apigateway:*, iam:PassRole

set -e

REGION="us-east-1"
FUNCTION_NAME="class-roster"
API_ID="0hzxan306l"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== 1/5  ดึง IAM Role จาก Lambda ที่มีอยู่ (lab-lister) ==="
ROLE_ARN=$(aws lambda get-function \
  --function-name lab-lister \
  --region "$REGION" \
  --query "Configuration.Role" \
  --output text)
echo "Role ARN: $ROLE_ARN"

echo ""
echo "=== 2/5  zip source ==="
cd "$SCRIPT_DIR"
zip -j function.zip index.mjs
echo "Created function.zip"

echo ""
echo "=== 3/5  สร้าง Lambda function ==="
# ลองสร้างใหม่ ถ้ามีอยู่แล้วให้ update code แทน
if aws lambda get-function --function-name "$FUNCTION_NAME" --region "$REGION" &>/dev/null; then
  echo "Lambda มีอยู่แล้ว → update code"
  aws lambda update-function-code \
    --function-name "$FUNCTION_NAME" \
    --zip-file fileb://function.zip \
    --region "$REGION" \
    --output text --query "FunctionArn"
else
  echo "Lambda ยังไม่มี → create"
  LAMBDA_ARN=$(aws lambda create-function \
    --function-name "$FUNCTION_NAME" \
    --runtime nodejs20.x \
    --role "$ROLE_ARN" \
    --handler index.handler \
    --zip-file fileb://function.zip \
    --region "$REGION" \
    --output text --query "FunctionArn")
  echo "Created: $LAMBDA_ARN"
fi

echo ""
echo "=== 4/5  เพิ่ม resource-based policy ให้ API Gateway invoke Lambda ==="
LAMBDA_ARN=$(aws lambda get-function \
  --function-name "$FUNCTION_NAME" \
  --region "$REGION" \
  --query "Configuration.FunctionArn" \
  --output text)

# ลบ statement เก่าก่อน (ถ้ามี) เพื่อไม่ให้ error ซ้ำ
aws lambda remove-permission \
  --function-name "$FUNCTION_NAME" \
  --statement-id "apigw-invoke-class-roster" \
  --region "$REGION" 2>/dev/null || true

aws lambda add-permission \
  --function-name "$FUNCTION_NAME" \
  --statement-id "apigw-invoke-class-roster" \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:${REGION}:*:${API_ID}/*/*/class-roster" \
  --region "$REGION" \
  --output text --query "Statement" | python3 -c "import sys,json; s=json.loads(sys.stdin.read()); print('Permission added:', s.get('Sid',''))" 2>/dev/null || echo "Permission added."

echo ""
echo "=== 5/5  สร้าง API Gateway integration + route ==="
# สร้าง Lambda integration
INTEGRATION_ID=$(aws apigatewayv2 create-integration \
  --api-id "$API_ID" \
  --integration-type AWS_PROXY \
  --integration-uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${LAMBDA_ARN}/invocations" \
  --payload-format-version "2.0" \
  --region "$REGION" \
  --output text --query "IntegrationId")
echo "Integration ID: $INTEGRATION_ID"

# สร้าง route GET /class-roster
aws apigatewayv2 create-route \
  --api-id "$API_ID" \
  --route-key "GET /class-roster" \
  --target "integrations/$INTEGRATION_ID" \
  --region "$REGION" \
  --output text --query "RouteId"
echo "Route GET /class-roster created."

# Deploy stage $default
aws apigatewayv2 create-deployment \
  --api-id "$API_ID" \
  --stage-name '$default' \
  --region "$REGION" \
  --output text --query "DeploymentId"
echo "Deployed to \$default stage."

echo ""
echo "✓ เสร็จแล้ว! ทดสอบด้วย:"
echo "  curl https://${API_ID}.execute-api.${REGION}.amazonaws.com/class-roster"

# cleanup
rm -f function.zip
