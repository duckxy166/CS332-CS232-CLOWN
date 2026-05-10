# CS332-CS232-CLOWN

ระบบจัดการแล็บและตรวจงานอัตโนมัติสำหรับวิชา CS332/CS232 — ครอบคลุมตั้งแต่การสร้างบัญชีผ่าน CSV, การตรวจงานอัตโนมัติด้วย AI OCR (AWS Textract) ตามกฎที่ TA กำหนด, ไปจนถึงการประมวลผลแบบ Asynchronous Pipeline (SQS + Lambda) เพื่อรองรับการส่งงานจำนวนมากพร้อมรายงานผลทันที

**Link Web:** (https://duckxy166.github.io/CS332-CS232-CLOWN/)

## สถาปัตยกรรม (3 Flows)

```
FLOW 1 — TA สร้าง Lab
  TA → API Gateway
        ├─ reference-upload → S3 (lab-checker-reference) + Textract preview
        └─ lab-config       → DynamoDB (Labs)

FLOW 2 — Student ส่งงาน + ตรวจอัตโนมัติ
  Student → API Gateway
        └─ submission-handler ─┬─ S3 (lab-checker-screenshots)
                               ├─ DynamoDB (Submissions, status=PENDING)
                               └─ SQS (lab-checker-queue) ─┐
                                                            ▼
                                         checker-engine (SQS trigger)
                                           ├─ Textract OCR
                                           ├─ เทียบกับ rules + thresholds
                                           └─ DynamoDB (Submissions, status=PASSED/REJECTED)
  Student → result-reader → DynamoDB (Submissions)  // poll ดูผล

FLOW 3 — TA ดูผล
  TA → submission-viewer → DynamoDB (Submissions + Labs) + S3 presigned URLs
```

## บริการ AWS ที่ใช้

| Service | หน้าที่ |
|---------|---------|
| S3 | 2 buckets: `lab-checker-reference` (รูป reference ของ TA), `lab-checker-screenshots` (งานนักศึกษา) + bucket สำหรับ CSV สร้างบัญชี |
| DynamoDB | `User`, `ClassRoster`, `Labs`, `Submissions` |
| Lambda | 9 functions (Flow 1/2/3) + `keepAccount` + `class-roster` |
| SQS | `lab-checker-queue` คั่นกลางระหว่าง submission-handler กับ checker-engine |
| Textract | OCR ข้อความ + bounding box (ใช้ใน reference-upload และ checker-engine) |
| Cognito | User Pool — บัญชีถูก provision จาก CSV |
| API Gateway | REST API endpoints |
| IAM | LabRole สำหรับ execution role |

---

## โครงสร้างโปรเจกต์

```
CS332-CS232-CLOWN/
├── src/
│   ├── backend/
│   │   └── functions/
│   │       ├── lab-config/index.mjs          # FLOW 1 — TA สร้าง lab → Labs table
│   │       ├── lab-lister/index.mjs          # ดึง list labs ทั้งหมด
│   │       ├── reference-upload/index.mjs    # FLOW 1 — อัป reference image + Textract preview
│   │       ├── submission-handler/index.mjs  # FLOW 2a — Student ส่งงาน → S3 + Submissions + SQS
│   │       ├── checker-engine/index.mjs      # FLOW 2b — SQS trigger → Textract → grade
│   │       ├── result-reader/index.mjs       # Student ดูผล (poll)
│   │       ├── submission-viewer/index.mjs   # FLOW 3 — TA ดูงานทั้งหมดของ lab + presigned URLs
│   │       └── class-roster/index.mjs        # ดึง roster จาก DynamoDB ClassRoaster
│   └── frontend/
│       ├── index.html / index_script.js     # Login
│       ├── student/
│       │   ├── student_dashboard.html        # แดชบอร์ดนักศึกษา
│       │   ├── student_Lablist.html          # list labs ของวิชา
│       │   ├── submissionPage.html           # ส่งงาน (FLOW 2a)
│       │   └── submissionResult.html         # ดูผล (poll FLOW 2b)
│       └── TA/
│           ├── Ta_Dashboard.html             # แดชบอร์ด TA
│           ├── TaLablist.html                # list labs ที่ TA สร้าง
│           ├── Ta_CreateLab.html             # FLOW 1 — สร้าง lab + rules
│           └── TaViewSubmission.html         # FLOW 3 — ดูงานนักศึกษา
├── keepAccount.mjs                            # Lambda: CSV → Cognito + DynamoDB
├── phurin/AWS lambda/                         # โค้ด Lambda รุ่น development (mirror ของ src/backend/functions)
├── saharat/mock/                              # mock end-to-end (รันใน browser ล้วน, ไม่ต้องมี AWS) — ดู saharat/mock/README.md
├── scripts/
│   └── setup-lifecycle-policy.sh             # ตั้ง S3 lifecycle policy
├── tests/                                     # Jest tests
├── package.json
└── README.md
```

---

## Prerequisites

ต้องมีให้พร้อมก่อนเริ่ม:

### Hardware/OS
- Windows 11 / macOS / Linux
- ขั้นต่ำ 4GB RAM (ต้อง AWS Console + VS Code + Browser)

### Software
- **AWS Account** (Learner Lab หรือ Personal) ✅
- **AWS CLI** (`aws --version` ตรวจสอบ) → [Install](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)
- **Node.js 20.x+** (สำหรับ run tests + mock server) → [Download](https://nodejs.org/)
- **Git** (clone repo) → [Install](https://git-scm.com/)
- **bash/zsh shell** (สำหรับ run `setup-lifecycle-policy.sh` script)
  - Windows: ใช้ **Git Bash** หรือ **WSL 2** (หรือ PowerShell โดยแก้ script)
  - macOS/Linux: มีแล้ว

### IDE (optional แต่แนะนำ)
- VS Code + Extensions: REST Client, Live Server, AWS Toolkit

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

### 2. Configure AWS CLI (หลังจาก Start Lab)

AWS CLI ต้อง credentials จาก Learner Lab:

1. เปิด AWS Academy Learner Lab Console
2. กด **AWS Details** > **Show** ที่ AWS CLI section
3. คัดลอก 3 ค่า แล้วรัน (ทีละ session):
   ```bash
   export AWS_ACCESS_KEY_ID="<ACCESS_KEY>"
   export AWS_SECRET_ACCESS_KEY="<SECRET_KEY>"
   export AWS_SESSION_TOKEN="<SESSION_TOKEN>"
   ```

4. ตรวจสอบ:
   ```bash
   aws sts get-caller-identity
   ```

5. ถ้าได้ output JSON ✅ สำเร็จ

> ⚠️ เมื่อ Stop Lab → credentials หมดอายุ ต้อง export ใหม่เมื่อ Start Lab ครั้งต่อไป

---

### 3. สร้าง S3 Buckets

สร้าง **3 buckets** (Region: **US East (N. Virginia) us-east-1**):

| Bucket name (ตัวอย่าง) | ใช้ทำอะไร | ใช้ใน Lambda |
|------------------------|-----------|--------------|
| `lab-checker-reference` | เก็บรูป reference ที่ TA อัปตอนสร้าง lab | `reference-upload` |
| `lab-checker-screenshots` | เก็บ screenshot ที่นักศึกษาส่ง | `submission-handler`, `checker-engine`, `submission-viewer` |
| `<your-csv-bucket>` | รับไฟล์ CSV สร้างบัญชี (ตั้งชื่อเองได้) | `keepAccount` (S3 trigger) |

> ชื่อ bucket ต้องไม่ซ้ำใครในโลก ถ้าจะใช้ชื่ออื่นต้องไปแก้ค่าคงที่ `BUCKET` / `SCREENSHOT_BUCKET` ใน Lambda code ให้ตรงกัน

---

### 4. ตั้ง CORS ให้ S3 Buckets

ต้องตั้งให้ทั้ง `lab-checker-reference` และ `lab-checker-screenshots` (เพราะ frontend จะโหลด presigned URL):

1. เข้า S3 > กดเข้า bucket > tab **Permissions**
2. เลื่อนลงหา **Cross-origin resource sharing (CORS)** > กด **Edit**
3. วาง JSON นี้:

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

4. กด **Save changes**

---

### 5. ตั้ง Lifecycle Policy (ลบไฟล์เก่าอัตโนมัติ)

ตั้ง policy ให้ S3 ลบไฟล์ที่อายุเกิน 30 วันโดยอัตโนมัติ (รันกับ `lab-checker-screenshots`):

```bash
./scripts/setup-lifecycle-policy.sh lab-checker-screenshots
```

script จะเช็ค bucket, แสดง policy ปัจจุบัน, ถาม confirm ก่อน apply

---

### 6. สร้าง DynamoDB Tables

เข้า AWS Console > ค้นหา **DynamoDB** > กด **Create table** สร้างทั้ง 4 ตาราง:

#### ตารางที่ 1: User

| Setting | Value |
|---------|-------|
| Table name | `User` |
| Partition key | `UserID` (String) |
| Sort key | — |

Attributes: `email`, `Role`

#### ตารางที่ 2: ClassRoster

| Setting | Value |
|---------|-------|
| Table name | `ClassRoster` |
| Partition key | `email` (String) |
| Sort key | `classID` (String) |

Attributes: `UserID`, `section`

#### ตารางที่ 3: Labs

| Setting | Value |
|---------|-------|
| Table name | `Labs` |
| Partition key | `labID` (String) |
| Sort key | — |

Attributes: `labName`, `subjectId`, `sections`, `description`, `deadline`, `images`, `rules`, `thresholds`, `createdBy`, `status`, `createdAt`

#### ตารางที่ 4: Submissions

| Setting | Value |
|---------|-------|
| Table name | `Submissions` |
| Partition key | `email` (String) |
| Sort key | `labID` (String) |

Attributes: `submissionID`, `screenshots[]`, `status` (`PENDING`/`PASSED`/`REJECTED`), `totalScore`, `scoreResult[]`, `submittedAt`, `checkedAt`

> ใช้ composite key (email + labID) จึงดูผลของนักศึกษาคนหนึ่งใน lab หนึ่งได้ตรงๆ ไม่ต้องใช้ GSI

---

### 7. สร้าง Cognito User Pool

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

### 8. สร้าง SQS Queue

1. เข้า AWS Console > ค้นหา **SQS** > กด **Create queue**
2. Type: **Standard**
3. Name: `lab-checker-queue`
4. ค่าอื่นๆ: default
5. กด **Create queue**
6. จด **Queue URL** ไว้ (รูปแบบ: `https://sqs.us-east-1.amazonaws.com/<ACCOUNT_ID>/lab-checker-queue`)

> Queue URL ต้องไปแก้ใน `submission-handler/index.mjs` ค่าคงที่ `QUEUE_URL` ให้ตรงกับ account ของคุณ

---

### 9. สร้าง Lambda Functions

เข้า AWS Console > ค้นหา **Lambda** > กด **Create function**

การตั้งค่าพื้นฐานทุก function:
- Runtime: **Node.js 20.x**
- Handler: `index.handler`
- Execution role: **Use an existing role** > เลือก **LabRole**
- Architecture: x86_64

> ทุก Lambda ในโปรเจกต์นี้เป็น `.mjs` (ESM) — ใช้ `import` ไม่ใช่ `require()` เนื่องจากใช้ AWS SDK v3 ที่อยู่ใน Node 20 runtime อยู่แล้ว ไม่ต้อง bundle node_modules

#### 9.1 keepAccount (สร้างบัญชีจาก CSV)

| Setting | Value |
|---------|-------|
| Function name | `keepAccount` |
| Code source | `keepAccount.mjs` |
| Timeout | **1 นาที** (Configuration > General > Edit) |
| Trigger | S3 (CSV bucket) |

**ค่าที่ต้องแก้ใน code:**
- บรรทัด 11: `TABLE_USER` = ชื่อตาราง User
- บรรทัด 12: `TABLE_ROSTER` = ชื่อตาราง ClassRoster
- บรรทัด 13: `USER_POOL_ID` = User Pool ID จาก Cognito

**ตั้ง Trigger:** Configuration > Triggers > Add trigger > **S3** > เลือก CSV bucket > Event type: `All object create events` > Suffix: `.csv`

**รูปแบบ CSV:**
```
UserID,Role,email,classID,section
6xxxxxxx,Student,student@dome.tu.ac.th,CS232,1
,TA,ta@dome.tu.ac.th,CS232,1
```

> TA ไม่ต้องมี UserID ระบบจะสร้างให้อัตโนมัติ (TA-XXXXX) | รหัสผ่านเริ่มต้น: `Test1234!`

---

#### 9.2 lab-config (FLOW 1 — สร้าง Lab)

| Setting | Value |
|---------|-------|
| Function name | `lab-config` |
| Code source | `src/backend/functions/lab-config/index.mjs` |
| Trigger | API Gateway: `POST /lab-config` |

เก็บ `labName, subjectId, sections, description, deadline, images, rules, thresholds` ลง `Labs` table โดย generate `labID` เป็น UUID

#### 9.3 lab-lister (ดู list labs)

| Setting | Value |
|---------|-------|
| Function name | `lab-lister` |
| Code source | `src/backend/functions/lab-lister/index.mjs` |
| Trigger | API Gateway: `GET /labs` |

Scan ตาราง `Labs` ทั้งหมด ส่งกลับ list

#### 9.4 reference-upload (FLOW 1 — อัป reference image)

| Setting | Value |
|---------|-------|
| Function name | `reference-upload` |
| Code source | `src/backend/functions/reference-upload/index.mjs` |
| Trigger | API Gateway: `POST /reference-upload` |
| Timeout | **30 วินาที** (Textract ใช้เวลา) |

**ค่าคงที่ใน code:** `BUCKET = "lab-checker-reference"`

รับ `imageBase64`, `imageType`, `labID` → อัปขึ้น S3 → รัน Textract → ส่งกลับ blocks (text + bounding box) ให้ TA preview ก่อนสร้าง rule

#### 9.5 submission-handler (FLOW 2a — Student ส่งงาน)

| Setting | Value |
|---------|-------|
| Function name | `submission-handler` |
| Code source | `src/backend/functions/submission-handler/index.mjs` |
| Trigger | API Gateway: `POST /submission` |
| Timeout | **30 วินาที** |

**ค่าคงที่ที่ต้องแก้ใน code:**
- `SCREENSHOT_BUCKET = "lab-checker-screenshots"`
- `QUEUE_URL = "https://sqs.us-east-1.amazonaws.com/<ACCOUNT_ID>/lab-checker-queue"` ← **เปลี่ยนตาม account ของคุณ**

Flow: รับ `email, labID, screenshots[]` → อัปทุกรูปขึ้น S3 → PUT `Submissions` (status=`PENDING`) → SendMessage SQS

#### 9.6 checker-engine (FLOW 2b — Auto grader)

| Setting | Value |
|---------|-------|
| Function name | `checker-engine` |
| Code source | `src/backend/functions/checker-engine/index.mjs` |
| Trigger | **SQS** queue `lab-checker-queue` |
| Timeout | **2-3 นาที** (ขึ้นกับจำนวนรูป) |

**ค่าคงที่ใน code:** `SCREENSHOT_BUCKET = "lab-checker-screenshots"`

Flow ต่อ image:
1. ดึง lab จาก `Labs` (rules + thresholds)
2. รัน Textract บนรูป → ได้ text + bounding box
3. เทียบแต่ละ rule:
   - **keyword only** (`rule.pos = false`) → match แค่เจอคำ
   - **keyword + position** → match พิกัด ± tolerance ตาม `rule.sens` (low=0.30, medium=0.15, high=0.05)
4. รวมคะแนน, เช็ค threshold + mandatory rules → image PASSED/REJECTED
5. UPDATE `Submissions` ด้วย `status, scoreResult, totalScore, checkedAt`

**ตั้ง SQS Trigger:** Configuration > Triggers > Add trigger > **SQS** > เลือก `lab-checker-queue` > Batch size: 1

#### 9.7 result-reader (Student ดูผล)

| Setting | Value |
|---------|-------|
| Function name | `result-reader` |
| Code source | `src/backend/functions/result-reader/index.mjs` |
| Trigger | API Gateway: `GET /result?email=&labID=` |

Get item จาก `Submissions` ด้วย composite key (`email`, `labID`) — frontend `submissionResult.html` จะ poll endpoint นี้

#### 9.8 submission-viewer (FLOW 3 — TA ดูงาน)

| Setting | Value |
|---------|-------|
| Function name | `submission-viewer` |
| Code source | `src/backend/functions/submission-viewer/index.mjs` |
| Trigger | API Gateway: `GET /submissions?labID=` |
| Timeout | **30 วินาที** |

**ค่าคงที่ใน code:** `SCREENSHOT_BUCKET = "lab-checker-screenshots"`, `PRESIGN_EXPIRY = 900` (15 นาที)

Scan `Submissions` filter โดย `labID` → generate presigned GET URL ให้ทุก screenshot → รวมกับ `lab` info + `stats` (total/passed/rejected/pending)

#### 9.9 class-roster (Load student roster)

| Setting | Value |
|---------|-------|
| Function name | `class-roster` |
| Code source | `src/backend/functions/class-roster/index.mjs` |
| Trigger | API Gateway: `GET /class-roster` |
| Timeout | **30 วินาที** |

**ค่าคงที่ใน code:** hardcoded table `ClassRoaster`

Flow: Scan ตาราง `ClassRoaster` ทั้งหมด → cache 60 วินาที → ส่ง JSON กลับ

**ทำไมต้องมี?**
- Frontend โหลด roster ที่ `src/frontend/roster.json` ล้วนไม่ได้ (ไฟล์ static ไม่ update)
- ต้อง API endpoint ที่ fetch ข้อมูล live จาก DynamoDB
- เช็ก Cognito role มี lag → fetch ClassRoaster ตรงแทน

---

### 10. ตั้งค่า API Gateway

1. เข้า AWS Console > ค้นหา **API Gateway**
2. กด **Create API** > เลือก **REST API** > กด **Build**
3. ตั้งชื่อ API เช่น `clown-api`

#### สร้าง Resources และ Methods:

| Resource Path | Method | Lambda Function | ใช้ใน Flow |
|--------------|--------|----------------|-----------|
| `/lab-config` | POST | `lab-config` | FLOW 1 — สร้าง lab |
| `/labs` | GET | `lab-lister` | TA dashboard / Student lab list |
| `/reference-upload` | POST | `reference-upload` | FLOW 1 — อัป reference + Textract |
| `/submission` | POST | `submission-handler` | FLOW 2a — student ส่งงาน |
| `/result` | GET | `result-reader` | FLOW 2b — student poll ผล |
| `/submissions` | GET | `submission-viewer` | FLOW 3 — TA ดูงานทั้งหมด |
| `/class-roster` | GET | `class-roster` | Load roster locally |

> ไม่ต้องสร้าง endpoint ของ `checker-engine` เพราะ trigger ด้วย SQS ไม่ใช่ HTTP

#### Enable CORS:

แต่ละ resource ต้องเปิด CORS:
1. เลือก resource > กด **Enable CORS**
2. ตั้งค่า:
   - **Access-Control-Allow-Origin**: `https://incredible-sprinkles-0d48b2.netlify.app` (หรือ `*` ระหว่างพัฒนา)
   - **Access-Control-Allow-Headers**: `Content-Type,Authorization`
   - **Access-Control-Allow-Methods**: ตาม method ที่ใช้ (GET, POST, OPTIONS)
3. กด **Save**

#### Deploy API:

1. กด **Deploy API** > Stage: สร้างใหม่ชื่อ `prod` > กด **Deploy**
2. จด **Invoke URL** (รูปแบบ: `https://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com/prod`)
3. เอา Invoke URL ไปใส่ใน frontend script files (ค้นหา `API_BASE` หรือ fetch URL)

---

### 11. แก้ค่าคงที่ใน Lambda + Frontend

เนื่องจาก Lambda ในโปรเจกต์นี้ **hardcode ชื่อ bucket / queue URL** (ไม่ใช้ env vars) ต้องแก้ตามนี้:

| File | บรรทัดที่ต้องแก้ |
|------|-----------------|
| `src/backend/functions/submission-handler/index.mjs` | `QUEUE_URL` (account ID) |
| `src/backend/functions/submission-handler/index.mjs` | `SCREENSHOT_BUCKET` (ถ้าเปลี่ยนชื่อ bucket) |
| `src/backend/functions/checker-engine/index.mjs` | `SCREENSHOT_BUCKET` |
| `src/backend/functions/submission-viewer/index.mjs` | `SCREENSHOT_BUCKET` |
| `src/backend/functions/reference-upload/index.mjs` | `BUCKET` (`lab-checker-reference`) |
| `keepAccount.mjs` | `TABLE_USER`, `TABLE_ROSTER`, `USER_POOL_ID` |
| `src/frontend/**/*_script.js` | API base URL ของ API Gateway |

### 11.5 Frontend Customization (ต้องทำก่อน Deploy)

เนื่องจาก frontend hardcode API URL + Cognito details ต้องแก้ไฟล์ `src/frontend/api-config.js` ตามนี้:

#### ✏️ Update `API_BASE` (บรรทัด 2)
```javascript
// ⬇️ เปลี่ยนตามค่า Invoke URL ของ API Gateway ที่คุณสร้างใน section 10
const API_BASE = "https://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com";
```

#### ✏️ Update `COGNITO_LOGIN_URL` (บรรทัด 5-9)
```javascript
const COGNITO_LOGIN_URL = "https://<YOUR_COGNITO_DOMAIN>.auth.us-east-1.amazoncognito.com/login"
  + "?client_id=<YOUR_CLIENT_ID>"
  + "&response_type=token"
  + "&scope=email+openid"
  + "&redirect_uri=https://<YOUR_DOMAIN>/CS332-CS232-CLOWN/index.html";  // ← Update domain ตามที่ deploy
```

**ที่ไหนหา values:**
- `Invoke URL` → AWS Console > API Gateway > APIs > clown-api > Stages > prod > Invoke URL
- `COGNITO_DOMAIN` → AWS Console > Cognito > User Pools > (select pool) > App integration > Domain name
- `CLIENT_ID` → AWS Console > Cognito > User Pools > (select pool) > App clients and analytics > (select app) > Client ID
- `redirect_uri` → หลังจาก deploy frontend ให้ URL ตรงกับเว็บไซต์ที่ host frontend

---

### ⚠️ ถ้าลืมแก้ frontend จะเกิด:
- `fetch` to API fails (404 or wrong URL)
- Cognito login redirect ไปไม่ถูกที่
- localStorage token ตกหาย
- "Cannot read properties of null" errors ใน browser console

---

## การทดสอบ

### Mock end-to-end (ไม่ต้องมี AWS)

รัน mock ที่จำลองทั้ง pipeline ใน browser ล้วน:

```powershell
npx serve saharat/mock
```

ดูรายละเอียดเพิ่มที่ [`saharat/mock/README.md`](saharat/mock/README.md)

### Jest tests (legacy)

```bash
npm install
npm test
```

> **หมายเหตุ:** test files ใน `tests/` (`get-submissions`, `image-access`, `lab-management`, `ta-grade`, `ta-submissions`) เขียนไว้สำหรับ Lambda ชุดเก่า — **ยังไม่ได้อัปเดตให้เข้ากับ pipeline ใหม่ (lab-config / submission-handler / checker-engine / submission-viewer)** ถือว่ารอ rewrite

### ทดสอบ frontend จริง (ต้องใช้ HTTP Server)

```bash
cd src/frontend
npx serve .   # ← **ต้อง HTTP server หรือ Live Server**
```

❌ **ห้าม** เปิด `file:///home/user/src/frontend/index.html` ตรงใน browser:
- OAuth redirect ไม่ทำงาน (localhost:3000 vs file://)
- localStorage ถูกขัด
- Fetch CORS ล้ม

✅ **ต้อง** serve ผ่าน `http://localhost:3000`:
- Cognito login redirect ทำงาน → token save ใน localStorage
- CORS headers มาจาก API Gateway
- Session persistence ทำงาน

---

## หมายเหตุสำคัญ

- Credentials ของ Learner Lab **หมดอายุทุก session** ต้องก๊อปใหม่ทุกรอบ
- รหัสผ่านเริ่มต้นทุกบัญชีที่สร้างจาก CSV: `Test1234!`
- S3 Lifecycle Policy ลบไฟล์ใน `lab-checker-screenshots` อายุ > 30 วัน อัตโนมัติ
- Cognito ใช้แค่จัดการบัญชี — auth flow จริงผ่าน TU API (`keepAccount` provision จาก CSV)
- Lambda ทุกตัวเป็น ESM (`.mjs`) ใช้ AWS SDK v3 ที่มาพร้อม Node 20 runtime — **ไม่ต้อง `npm install` หรือ zip dependencies**
- `submission-handler` กับ `checker-engine` คั่นด้วย SQS เพื่อให้ student ได้ response ทันที (status=PENDING) แล้วค่อย poll ผ่าน `result-reader`
- ตาราง `Submissions` ใช้ composite key (`email`, `labID`) — student คนหนึ่งส่ง lab เดิมซ้ำจะ **overwrite** record เดิม

---

## Troubleshooting

### ❓ Setup ด้วยไฟล์

#### Q1: "AWS CLI not found" เมื่อรัน `setup-lifecycle-policy.sh`
**A:** 
- ตรวจสอบ AWS CLI ติดตั้งแล้ว: `aws --version`
- ถ้าไม่มี → [Install AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)
- Windows ต้อง bash (ใช้ Git Bash หรือ WSL 2 ถ้า PowerShell ใช้ไม่ได้)

#### Q2: "bucket not found" หรือ "access denied"
**A:**
- ตรวจสอบ credentials ได้ set ไหม: `aws sts get-caller-identity`
- Bucket ชื่อตรงกับที่สร้างในไป AWS Console ไหม
- Start Lab ยังสีเขียวอยู่ไหม (session ไม่หมดอายุ)

---

### ❓ Frontend Issues

#### Q3: Browser console: "Failed to fetch from API" / "404"
**A:**
- ตรวจสอบ `api-config.js` line 2: `API_BASE` ตรงกับ Invoke URL ไหม
- ตรวจสอบ API Gateway ใน AWS Console ว่า Deploy แล้ว
- ตรวจสอบ CORS settings บน API Gateway resources

#### Q4: Cognito login redirect ไปไม่ถูก / "redirect_uri_mismatch"
**A:**
- ตรวจสอบ `api-config.js` line 9: `redirect_uri` ตรงกับ frontend URL ไหม
- Cognito App Settings > Callback URLs ต้องตรงกับ `redirect_uri`
- ถ้าเปลี่ยน frontend domain (เช่น from localhost → GitHub Pages) ต้องแก้ทั้ง 2 ที่

#### Q5: Cognito login สำเร็จ แต่ page ว่างเปล่า / "undefined is not a function"
**A:**
- Open browser DevTools > Console
- ตรวจสอบมี error "Cannot read property of null"
- ตรวจสอบ `roster.json` load สำเร็จไหม (Network tab)
- ตรวจสอบ `/class-roster` API endpoint ทำงานไหม

---

### ❓ Lambda Issues

#### Q6: `checker-engine` timeout / "Task timed out"
**A:**
- Lambda timeout ต้องเพิ่มจาก default 3 วินาทีเป็น 2-3 นาที (Textract ใช้เวลา)
- Textract OCR เวลา 10-30 วินาทีต่อรูป

#### Q7: Lambda invoke แล้ว error "Cannot find module '@aws-sdk'"
**A:**
- Lambda ต้องใช้ Node.js 20.x runtime (AWS SDK v3 มาพร้อม)
- ตรวจสอบ Configuration > Runtime ให้เป็น Node.js 20.x
- **ห้าม** zip node_modules (Lambda มีแล้ว)

---

### ✅ Verification Checklist

- [ ] AWS CLI credentials set: `aws sts get-caller-identity` ✓
- [ ] S3 buckets สร้างแล้ว 3 อัน
- [ ] DynamoDB tables สร้างแล้ว 4 ตาราง
- [ ] Cognito User Pool สร้างแล้ว + custom attribute `role`
- [ ] SQS queue `lab-checker-queue` สร้างแล้ว
- [ ] Lambda functions สร้างแล้ว 9 อัน (ตรวจสอบใน AWS Console)
- [ ] API Gateway endpoints deploy แล้ว
- [ ] `src/frontend/api-config.js` update ค่า `API_BASE` + `COGNITO_LOGIN_URL`
- [ ] Frontend รันผ่าน `npx serve src/frontend` ไม่ใช่ `file:///`
- [ ] Test login ด้วย test account จาก CSV
