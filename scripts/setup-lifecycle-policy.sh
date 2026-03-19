#!/bin/bash
# =========================================================
# S3 Lifecycle Policy Setup Script
# ตั้ง retention policy สำหรับ submissions bucket
# Rule: ลบไฟล์ใน submissions/ ที่อายุเกิน 30 วัน
#
# Usage:
#   ./scripts/setup-lifecycle-policy.sh <bucket-name>
#
# Example:
#   ./scripts/setup-lifecycle-policy.sh cs332-submissions-bucket
# =========================================================

set -euo pipefail

BUCKET_NAME="${1:-}"

LIFECYCLE_CONFIG='{
    "Rules": [
        {
            "ID": "submissions-retention-policy",
            "Status": "Enabled",
            "Filter": {
                "Prefix": "submissions/"
            },
            "Expiration": {
                "Days": 30
            }
        }
    ]
}'

# --- Validate input ---
if [ -z "$BUCKET_NAME" ]; then
    echo "Error: กรุณาระบุชื่อ bucket"
    echo "Usage: $0 <bucket-name>"
    exit 1
fi

# --- Check AWS CLI ---
if ! command -v aws &> /dev/null; then
    echo "Error: ไม่พบ AWS CLI กรุณาติดตั้งก่อน"
    echo "https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"
    exit 1
fi

# --- Verify bucket exists ---
echo "Checking bucket: $BUCKET_NAME ..."
if ! aws s3api head-bucket --bucket "$BUCKET_NAME" 2>/dev/null; then
    echo "Error: ไม่พบ bucket '$BUCKET_NAME' หรือไม่มีสิทธิ์เข้าถึง"
    exit 1
fi

# --- Show current lifecycle (if any) ---
echo ""
echo "=== Lifecycle Policy ปัจจุบัน ==="
aws s3api get-bucket-lifecycle-configuration --bucket "$BUCKET_NAME" 2>/dev/null || echo "(ยังไม่มี lifecycle policy)"

# --- Confirm before applying ---
echo ""
echo "=== Lifecycle Policy ใหม่ที่จะ apply ==="
echo "$LIFECYCLE_CONFIG"
echo ""
read -p "ต้องการ apply lifecycle policy นี้ไปที่ $BUCKET_NAME? (y/N): " CONFIRM

if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
    echo "ยกเลิก"
    exit 0
fi

# --- Apply lifecycle policy ---
echo "Applying lifecycle policy..."
aws s3api put-bucket-lifecycle-configuration \
    --bucket "$BUCKET_NAME" \
    --lifecycle-configuration "$LIFECYCLE_CONFIG"

echo ""
echo "=== Apply สำเร็จ! Verifying... ==="
aws s3api get-bucket-lifecycle-configuration --bucket "$BUCKET_NAME"

echo ""
echo "Done! Lifecycle policy ถูกตั้งค่าเรียบร้อยแล้ว"
