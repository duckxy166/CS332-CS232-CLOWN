# CS332-CS232-CLOWN

ระบบจัดการแลปสำหรับวิชา CS332/CS232 — ส่งงานผ่านรูปภาพ พร้อม ML ตรวจงานอัตโนมัติด้วย AWS TextTrack

**Frontend:** https://incredible-sprinkles-0d48b2.netlify.app/

## บริการ AWS ที่ใช้

| Service | หน้าที่ |
|---------|---------|
| S3 | เก็บรูปภาพที่ส่ง + อัปโหลด CSV สร้างบัญชี |
| DynamoDB | เก็บข้อมูล User, ClassRoster, Submissions, Labs |
| Lambda | Backend functions ทั้งหมด (10+ functions) |
| Cognito | User Pool จัดการบัญชีผู้ใช้ (สร้างจาก CSV) |
| TextTrack | ตรวจจับข้อความในรูปภาพ (phurin กำลังดำเนินการในส่วนนี้) |
| SQS | Queue สำหรับ async checker pipeline (Phurin กำลังดำเนินการ) |
| API Gateway | REST API endpoints เชื่อม frontend กับ Lambda |
| IAM | LabRole สำหรับ execution role |

---

## โครงสร้างโปรเจกต์

```
CS332-CS232-CLOWN/
├── src/
│   ├── backend/
│   │   ├── config/
│   │   │   └── aws-config.js              # ตั้งค่า AWS SDK clients (S3, Textract, SQS, DynamoDB)
│   │   ├── functions/
│   │   │   ├── auth-verify/index.js        # ยืนยันตัวตนผ่าน TU API
│   │   │   ├── upload-image/index.js       # อัปโหลดรูป + ตรวจสอบ
│   │   │   ├── get-submissions/index.js    # ดึงข้อมูลการส่งงานของนักศึกษา
│   │   │   ├── presigned-url/index.js      # สร้าง Pre-signed URL (upload/download)
│   │   │   ├── lab-management/index.js     # CRUD Lab (สร้าง/แก้ไข/ดูสถิติ)
│   │   │   ├── ta-submissions/index.js     # TA ดูงานที่ส่ง + filter + stats
│   │   │   ├── ta-grade/index.js           # TA ให้คะแนน + feedback
│   │   │   ├── image-access/index.js       # สร้าง signed URL ดูรูปภาพ
│   │   │   │
│   │   │   │── # --- Phurin's TextTrack Functions (กำลังดำเนินการ) ---
│   │   │   ├── checker-engine/index.mjs    # ตรวจงานด้วย Textract + keyword matching
│   │   │   ├── lab-config/index.mjs        # สร้าง Lab config พร้อม rules/thresholds
│   │   │   ├── lab-lister/index.mjs        # ดึงรายการ Labs ทั้งหมด
│   │   │   ├── reference-upload/index.mjs  # อัปโหลด reference image + Textract
│   │   │   ├── submission-handler/index.mjs # รับ submission + ส่ง SQS queue
│   │   │   └── result-reader/index.mjs     # อ่านผลตรวจ submission
│   │   └── utils/
│   │       └── response.js                 # CORS response helpers
│   └── frontend/
│       ├── student/
│       │   ├── student_dashboard.html      # หน้าแดชบอร์ดนักศึกษา
│       │   ├── dachboad_script.js
│       │   ├── submissionPage.html         # หน้าส่งงาน
│       │   ├── submissionPage_script.js
│       │   ├── submissionResult.html       # หน้าดูผลการส่งงาน
│       │   ├── submissionResult_script.js
│       │   └── submission_phurin.html      # หน้าส่งงาน (Phurin - กำลังดำเนินการ)
│       └── TA/
│           ├── Ta_Dashboard.html           # หน้าแดชบอร์ด TA
│           ├── TaDashboard_script.js
│           ├── taCreateLab.html            # หน้าสร้าง Lab + AI Rules
│           ├── taCreateLab.js
│           ├── taViewsubmission_PAGE.html  # หน้าดูงานที่ส่ง
│           ├── taView.js
│           └── taCreateLab_phurin.html     # หน้าสร้าง Lab (Phurin - กำลังดำเนินการ)
├── keepAccount.mjs                         # Lambda: CSV -> Cognito + DynamoDB
├── phurin/                                     # โค้ดต้นฉบับของ Phurin (สำรอง)
│   ├── AWS lambda/
│   │   ├── checkerEngine.mjs
│   │   ├── labConfig.mjs
│   │   ├── labLister.mjs
│   │   ├── referenceUpload.mjs
│   │   ├── submissionHandler.mjs
│   │   └── resultReader
│   └── Frontend/
│       ├── index.html
│       └── submission.html
├── scripts/
│   └── setup-lifecycle-policy.sh           # Script: ตั้ง S3 lifecycle policy
├── tests/                                  # Jest test suites
├── package.json
└── README.md
```

---

## วิธี Set Up (AWS Academy Learner Lab)

### 1. Start Learner Lab

1. เปิด AWS Academy Learner Lab
2. กด **Start Lab** รอจนไฟเป็น **สีเขียว**
3. กด **AWS Details** > กด **Show** ที่ AWS CLI
4. จะได้ 3 ค่า:
   - `aws_access_key_id` = Access Key
   - `aws_secret_access_key` = Secret Key
   - `aws_session_token` = Session Token

> ค่าเหล่านี้เปลี่ยนทุกครั้งที่ Start Lab ใหม่ ต้องก๊อปมาใส่ใหม่ทุกรอบ

---

### 2. สร้าง S3 Bucket

1. เข้า AWS Console > ค้นหา **S3**
2. กด **Create bucket**
3. ตั้งชื่อ bucket (ชื่อต้องไม่ซ้ำใครในโลก)
4. Region: **US East (N. Virginia) us-east-1**
5. กด **Create bucket**

> Bucket นี้ใช้ทั้งเก็บรูปภาพ submissions และรับไฟล์ CSV สำหรับสร้างบัญชี

---

### 3. ตั้ง CORS ให้ S3 Bucket

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

---

### 4. ตั้ง Lifecycle Policy (ลบไฟล์เก่าอัตโนมัติ)

ตั้ง policy ให้ S3 ลบไฟล์ submissions ที่อายุเกิน 30 วันโดยอัตโนมัติ:

```bash
./scripts/setup-lifecycle-policy.sh ชื่อ-bucket
```

script จะเช็ค bucket, แสดง policy ปัจจุบัน, ถาม confirm ก่อน apply

---

### 5. สร้าง DynamoDB Tables

เข้า AWS Console > ค้นหา **DynamoDB** > กด **Create table** สร้างทั้ง 4 ตาราง:

#### ตารางที่ 1: User

| Setting | Value |
|---------|-------|
| Table name | `User` |
| Partition key | `UserID` (String) |
| Sort key | ไม่ต้องใส่ |
| อื่นๆ | Default |

Attributes: `email`, `Role`

#### ตารางที่ 2: ClassRoster

| Setting | Value |
|---------|-------|
| Table name | `ClassRoster` |
| Partition key | `email` (String) |
| Sort key | `classID` (String) |
| อื่นๆ | Default |

Attributes: `UserID`, `section`

#### ตารางที่ 3: Submissions

| Setting | Value |
|---------|-------|
| Table name | `Submissions` |
| Partition key | `submissionId` (String) |
| Sort key | ไม่ต้องใส่ |
| อื่นๆ | Default |

สร้างเสร็จแล้วต้องเพิ่ม **Global Secondary Index (GSI)**:
1. เข้าตาราง Submissions > tab **Indexes**
2. กด **Create index**
3. Partition key: `studentId` (String)
4. Sort key: `labId` (String)
5. Index name: `studentId-labId-index`
6. กด **Create index**

#### ตารางที่ 4: Labs

| Setting | Value |
|---------|-------|
| Table name | `Labs` |
| Partition key | `courseId` (String) |
| Sort key | `labId` (String) |
| อื่นๆ | Default |

---

### 6. สร้าง Cognito User Pool

1. เข้า AWS Console > ค้นหา **Cognito**
2. กด **Create user pool**
3. เลือก **Single-page application (SPA)**
4. Options for sign-in identifiers: ติ๊ก **Email** และ **Username**
5. **ติ๊กออก** Enable self-registration (ไม่ให้สมัครเอง)
6. Select required attribute: **email**
7. กด **Create user directory**

#### เพิ่ม Custom Attribute (role):

1. ใน nav bar ด้านซ้ายกด **Sign-up**
2. กด **Add custom attributes**
3. Name: `role`
4. อื่นๆ: default
5. กด **Save**

> จด **User Pool ID** ไว้ (รูปแบบ: `us-east-1_XXXXXXXXX`) ต้องไปใส่ใน `keepAccount.mjs` บรรทัดที่ 13

---

### 7. สร้าง Lambda Functions

เข้า AWS Console > ค้นหา **Lambda** > กด **Create function**

การตั้งค่าพื้นฐานทุก function:
- Runtime: **Node.js 20.x**
- Execution role: **Use an existing role** > เลือก **LabRole**

> **หมายเหตุ**: code ใน repo ใช้ `require('../../config/aws-config')` ซึ่งใช้ได้แบบ zip upload เท่านั้น ถ้าจะวาง code ตรงใน Lambda Console ให้รวม config ไว้ในไฟล์เดียว

#### 7.1 keepAccount (สร้างบัญชีจาก CSV)

| Setting | Value |
|---------|-------|
| Function name | `keepAccount` |
| Code source | `keepAccount.mjs` |
| Timeout | **1 นาที** (Configuration > General > Edit) |
| Trigger | S3 bucket ที่สร้างไว้ |

**ค่าที่ต้องแก้ใน code:**
- บรรทัด 11: `TABLE_USER` = ชื่อตาราง User
- บรรทัด 12: `TABLE_ROSTER` = ชื่อตาราง ClassRoster
- บรรทัด 13: `USER_POOL_ID` = User Pool ID จาก Cognito

**ตั้ง Trigger:**
1. Configuration > Triggers > Add trigger
2. เลือก **S3**
3. เลือก bucket ที่สร้างไว้
4. Event type: `PUT` หรือ `All object create events`
5. Suffix: `.csv`

**รูปแบบ CSV:**
```
UserID,Role,email,classID,section
6xxxxxxx,Student,student@dome.tu.ac.th,CS232,1
,TA,ta@dome.tu.ac.th,CS232,1
```

> TA ไม่ต้องมี UserID ระบบจะสร้างให้อัตโนมัติ (TA-XXXXX)
> รหัสผ่านเริ่มต้น: `Test1234!`

#### 7.2 auth-verify (ยืนยันตัวตน TU API)

| Setting | Value |
|---------|-------|
| Function name | `auth-verify` |
| Code source | `src/backend/functions/auth-verify/index.js` |

**Environment Variables:**

| Key | Value |
|-----|-------|
| `TU_APPLICATION_KEY` | Application Key จาก TU API |

#### 7.3 upload-image (อัปโหลดรูปภาพ)

| Setting | Value |
|---------|-------|
| Function name | `upload-image` |
| Code source | `src/backend/functions/upload-image/index.js` |

**Environment Variables:**

| Key | Value |
|-----|-------|
| `S3_BUCKET_NAME` | ชื่อ bucket ที่สร้างไว้ |
| `SUBMISSIONS_TABLE` | `Submissions` |
| `LABS_TABLE` | `Labs` |
| `VALIDATE_FUNCTION` | `validate-image` |

ตรวจสอบ: ไฟล์ต้องเป็น JPG/PNG, ขนาด < 5MB, resolution >= 800x600

#### 7.4 Phurin's TextTrack Functions (กำลังดำเนินการ)

> **phurin กำลังดำเนินการในส่วนนี้** — ระบบตรวจงานด้วย Textract (TextTrack) + keyword matching

| Function Name | Code Source | Trigger |
|---------------|------------|---------|
| `checker-engine` | `src/backend/functions/checker-engine/index.mjs` | SQS: `lab-checker-queue` |
| `lab-config` | `src/backend/functions/lab-config/index.mjs` | API Gateway |
| `lab-lister` | `src/backend/functions/lab-lister/index.mjs` | API Gateway |
| `reference-upload` | `src/backend/functions/reference-upload/index.mjs` | API Gateway |
| `submission-handler` | `src/backend/functions/submission-handler/index.mjs` | API Gateway |
| `result-reader` | `src/backend/functions/result-reader/index.mjs` | API Gateway |

**Environment Variables (submission-handler):**

| Key | Value |
|-----|-------|
| `QUEUE_URL` | SQS Queue URL ของ `lab-checker-queue` |

#### 7.5 get-submissions (ดึงข้อมูลการส่งงาน)

| Setting | Value |
|---------|-------|
| Function name | `get-submissions` |
| Code source | `src/backend/functions/get-submissions/index.js` |

**Environment Variables:**

| Key | Value |
|-----|-------|
| `S3_BUCKET_NAME` | ชื่อ bucket |
| `SUBMISSIONS_TABLE` | `Submissions` |
| `LABS_TABLE` | `Labs` |

#### 7.6 presigned-url (สร้าง Pre-signed URL)

| Setting | Value |
|---------|-------|
| Function name | `presigned-url` |
| Code source | `src/backend/functions/presigned-url/index.js` |

**Environment Variables:**

| Key | Value |
|-----|-------|
| `S3_BUCKET_NAME` | ชื่อ bucket |

#### 7.7 lab-management (จัดการ Lab)

| Setting | Value |
|---------|-------|
| Function name | `lab-management` |
| Code source | `src/backend/functions/lab-management/index.js` |

**Environment Variables:**

| Key | Value |
|-----|-------|
| `SUBMISSIONS_TABLE` | `Submissions` |
| `LABS_TABLE` | `Labs` |

รองรับ: POST (สร้าง lab), GET (ดู lab/สถิติ), PUT (แก้ไข lab)

#### 7.8 ta-submissions (TA ดูงานที่ส่ง)

| Setting | Value |
|---------|-------|
| Function name | `ta-submissions` |
| Code source | `src/backend/functions/ta-submissions/index.js` |

**Environment Variables:**

| Key | Value |
|-----|-------|
| `SUBMISSIONS_TABLE` | `Submissions` |

#### 7.9 ta-grade (TA ให้คะแนน)

| Setting | Value |
|---------|-------|
| Function name | `ta-grade` |
| Code source | `src/backend/functions/ta-grade/index.js` |

**Environment Variables:**

| Key | Value |
|-----|-------|
| `SUBMISSIONS_TABLE` | `Submissions` |

#### 7.10 image-access (เข้าถึงรูปภาพ)

| Setting | Value |
|---------|-------|
| Function name | `image-access` |
| Code source | `src/backend/functions/image-access/index.js` |

**Environment Variables:**

| Key | Value |
|-----|-------|
| `S3_BUCKET_NAME` | ชื่อ bucket |

#### 7.11 labConfig (สร้าง Lab Config - taCreateLab)

| Setting | Value |
|---------|-------|
| Function name | `labConfig` |
| Code source | `phurin/AWS lambda/labConfig.mjs` |

เก็บข้อมูล: labName, subjectId, sections, description, deadline, images, rules, thresholds ลงใน DynamoDB `Labs` table

---

### 8. ตั้งค่า API Gateway

1. เข้า AWS Console > ค้นหา **API Gateway**
2. กด **Create API** > เลือก **REST API** > กด **Build**
3. ตั้งชื่อ API เช่น `clown-api`

#### สร้าง Resources และ Methods:

| Resource Path | Method | Lambda Function |
|--------------|--------|----------------|
| `/auth/verify` | POST | `auth-verify` |
| `/upload` | POST | `upload-image` |
| `/validate` | POST | `validate-image` |
| `/presigned-url` | POST | `presigned-url` |
| `/labs` | POST | `lab-management` |
| `/labs` | GET | `lab-management` |
| `/submissions` | GET | `get-submissions` |
| `/ta/submissions` | GET | `ta-submissions` |
| `/ta/grade` | PUT | `ta-grade` |
| `/image` | GET | `image-access` |
| `/lab-config` | POST | `labConfig` |

#### Enable CORS:

แต่ละ resource ต้องเปิด CORS:
1. เลือก resource > กด **Enable CORS**
2. ตั้งค่า:
   - **Access-Control-Allow-Origin**: `https://incredible-sprinkles-0d48b2.netlify.app`
   - **Access-Control-Allow-Headers**: `Content-Type,Authorization`
   - **Access-Control-Allow-Methods**: ตาม method ที่ใช้ (GET, POST, PUT, OPTIONS)
3. กด **Save**

> ต้องตั้ง CORS ให้อนุญาต origin จาก `https://incredible-sprinkles-0d48b2.netlify.app` เพื่อให้ frontend เรียก API ได้

#### Deploy API:

1. กด **Deploy API**
2. Stage: สร้างใหม่ชื่อ `prod`
3. กด **Deploy**
4. จด **Invoke URL** (รูปแบบ: `https://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com/prod`)
5. เอา Invoke URL ไปใส่ใน frontend code

---

### 9. ตั้งค่า taCreateLab กับ Lambda API

หน้า taCreateLab ใช้สำหรับ TA สร้าง Lab พร้อมตั้ง AI Rules

#### Frontend:

ไฟล์: `src/frontend/TA/taCreateLab.html` + `taCreateLab.js`

**ตั้งค่า Firebase** ใน `taCreateLab.js` บรรทัดที่ 2:
```javascript
const firebaseConfig = { databaseURL: "https://your-project-id.firebaseio.com" };
```
> แก้ `your-project-id` เป็น Firebase project ID ของคุณ (ใช้ดึงข้อมูลวิชาและ section)

#### Data Flow:

```
taCreateLab.js (Frontend)
    ↓ POST /lab-config
API Gateway
    ↓ invoke
labConfig Lambda (phurin/AWS lambda/labConfig.mjs)
    ↓ PutItem
DynamoDB (Labs table)
```

#### ข้อมูลที่ส่ง:

```json
{
    "labName": "Lab 1",
    "subjectId": "CS232",
    "sections": ["1", "2"],
    "description": "คำอธิบาย lab",
    "deadline": "2026-04-01T23:59:00",
    "images": [],
    "rules": {},
    "thresholds": {}
}
```

---

## ตัวแปร Environment (สรุปรวม)

| Variable | Default | คำอธิบาย |
|----------|---------|----------|
| `AWS_REGION` | `us-east-1` | Region ของ AWS |
| `S3_BUCKET_NAME` | - | ชื่อ S3 Bucket |
| `SUBMISSIONS_TABLE` | `Submissions` | ชื่อ DynamoDB table สำหรับ submissions |
| `LABS_TABLE` | `Labs` | ชื่อ DynamoDB table สำหรับ labs |
| `VALIDATE_FUNCTION` | `validate-image` | ชื่อ Lambda function สำหรับ TextTrack (phurin กำลังดำเนินการ) |
| `TU_APPLICATION_KEY` | - | Application Key สำหรับ TU API |

---

## การทดสอบ

```bash
npm install
npm test
```

Test files อยู่ใน `tests/`:
- `get-submissions.test.js`
- `image-access.test.js`
- `lab-management.test.js`
- `ta-grade.test.js`
- `ta-submissions.test.js`

ทดสอบ frontend:
```bash
cd src/frontend
npx serve .
```
หรือใช้ **Live Server** ใน VS Code

---

## หมายเหตุสำคัญ

- Credentials ของ Learner Lab **หมดอายุทุก session** ต้องก๊อปใหม่ทุกรอบ
- รหัสผ่านเริ่มต้นทุกบัญชีที่สร้างจาก CSV: `Test1234!`
- S3 Lifecycle Policy ลบไฟล์ submissions อายุ > 30 วัน อัตโนมัติ
- Auth ใช้ TU API (ไม่ใช่ Cognito auth flow) — Cognito ใช้สำหรับจัดการบัญชีผู้ใช้อย่างเดียว
- Firebase ใช้สำหรับดึงข้อมูล dropdown (วิชา/section) ใน taCreateLab เท่านั้น
- ถ้าวาง code ตรงใน Lambda Console ต้องรวม AWS config ไว้ในไฟล์เดียว (ใช้ `require()` relative path ไม่ได้)
- ส่วน TextTrack (ตรวจจับข้อความในรูป) — **phurin กำลังดำเนินการ**
