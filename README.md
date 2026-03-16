## โครงสร้างโปรเจกต์

```
src/
├── backend/
│   ├── config/
│   │   └── aws-config.js          # ตั้งค่า S3 + Rekognition client
│   └── functions/
│       ├── auth-verify/index.js    # ยืนยันตัวตนผู้ใช้
│       ├── get-submissions/index.js
│       ├── upload-image/index.js   # Lambda อัปโหลดรูปขึ้น S3
│       └── validate-image/index.js # Lambda เรียก Rekognition วิเคราะห์รูป
└── frontend/
    ├── index.html
    ├── login.html / login.js
    ├── main.html / main.js
    └── ExampleWithLearnerLab.html  # หน้าทดสอบ S3 + Rekognition
```

## วิธี Set Up

### 1. Start Learner Lab

1. เปิด AWS Academy Learner Lab
2. กด **Start Lab** รอจนไฟเป็น **สีเขียว**
3. กด **AWS Details** > กด **Show** ที่ AWS CLI
4. จะได้ 3 ค่า:
   - `aws_access_key_id` = Access Key
   - `aws_secret_access_key` = Secret Key
   - `aws_session_token` = Session Token

> ค่าเหล่านี้เปลี่ยนทุกครั้งที่ Start Lab ใหม่ ต้องก๊อปมาใส่ใหม่ทุกรอบ

### 2. สร้าง S3 Bucket

1. เข้า AWS Console > ค้นหา **S3**
2. กด **Create bucket**
3. ตั้งชื่อ bucket (ชื่อต้องไม่ซ้ำใครในโลก)
4. Region: **US East (N. Virginia) us-east-1**
5. กด **Create bucket**

### 3. ตั้ง CORS ให้ S3 Bucket

ถ้าจะเรียกจาก browser ต้องเปิด CORS:

1. เข้า S3 > กดเข้า bucket ของคุณ
2. กด tab **Permissions**
3. เลื่อนลงหา **Cross-origin resource sharing (CORS)** > กด **Edit**
4. วาง JSON นี้:

```json
[
    {
        "AllowedHeaders": ["*"],
        "AllowedMethods": ["GET", "PUT", "POST"],
        "AllowedOrigins": ["*"],
        "ExposeHeaders": []
    }
]
```

5. กด **Save changes**

### 4. ตั้งค่า Lambda (ถ้าใช้ backend)

Learner Lab มี Lambda `ProcessImageWithRekognition` ให้อยู่แล้ว ถ้าจะสร้างเอง:

1. เข้า AWS Console > ค้นหา **Lambda**
2. กด **Create function**
3. ตั้งชื่อ เช่น `upload-image`
4. Runtime: **Node.js 20.x**
5. Execution role: **Use an existing role** > เลือก **LabRole**
6. กด **Create function**
7. ไปที่ **Configuration** > **Environment variables** > เพิ่ม:

| Key | Value |
|---|---|
| `S3_BUCKET_NAME` | ชื่อ bucket ที่สร้างไว้ |

8. วาง code จาก `src/backend/functions/` ลงใน Lambda

**หมายเหตุ**: code ใน repo ใช้ `require('../../config/aws-config')` ซึ่งใช้ได้แบบ zip upload เท่านั้น ถ้าจะวาง code ตรงใน Lambda Console ให้รวม config ไว้ในไฟล์เดียว ตัวอย่าง:

```javascript
const { S3Client } = require('@aws-sdk/client-s3');
const { PutObjectCommand } = require('@aws-sdk/client-s3');
const { randomUUID } = require('crypto');

const s3Client = new S3Client({ region: 'us-east-1' });
const BUCKET_NAME = process.env.S3_BUCKET_NAME;

exports.handler = async (event) => {
  // ... code เหมือนใน upload-image/index.js
};
```

### 5. ทดสอบผ่าน Frontend

1. เปิด `src/frontend/ExampleWithLearnerLab.html` ผ่าน local server:

```bash
cd src/frontend
npx serve .
```

หรือใช้ Live Server ใน VS Code ก็ได้

2. ใส่ Access Key, Secret Key, Session Token จาก Learner Lab
3. ใส่ชื่อ S3 Bucket
4. เลือกรูป (.jpg / .png) แล้วกด **Upload to S3**
5. กด **Rekognition Check** เพื่อวิเคราะห์รูป
