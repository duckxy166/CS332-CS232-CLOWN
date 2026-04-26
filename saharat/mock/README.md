# ValidMate Mock — End-to-End AWS Serverless Flow

A self-contained, browser-only mock that simulates **the entire architecture** from
the design diagram. Every AWS service is replaced by an in-memory module backed by
`localStorage`, so the full flow runs without any cloud account.

```
                    Lab Submission System — End-to-End Flow (mocked)
┌─ FLOW 1 — TA creates Lab ────────────────────────────────────────────────────┐
│  TA → Cognito → Dashboard → Create Lab Form → API Gateway                    │
│       ├─ λ referenceUpload ──→ S3 (TAImages)                                 │
│       └─ λ labConfig       ──→ DynamoDB (LabConfig)                          │
└──────────────────────────────────────────────────────────────────────────────┘
┌─ FLOW 2 — Student submits + auto-grading ────────────────────────────────────┐
│  Student → Cognito → Dashboard → Submit Work → API Gateway                   │
│       └─ λ submissionHandler ─┬─ S3 (StudentImages)                          │
│                               ├─ DynamoDB (Submission)                       │
│                               └─ SQS (lab-checker-queue)  ──┐                │
│                                                              ▼               │
│                                          λ checkerEngine (poller)            │
│                                            ├─ Textract (OCR)                 │
│                                            ├─ compare with rules             │
│                                            └─ DynamoDB (Score)               │
└──────────────────────────────────────────────────────────────────────────────┘
┌─ FLOW 3 — TA reviews submissions ────────────────────────────────────────────┐
│  TA → Dashboard → View Submissions → API Gateway                             │
│       └─ λ submissionViewer ─┬─ S3 (read student images)                     │
│                              └─ DynamoDB (read submission + score)           │
│                              + TA manual decision (Pass / Reject)            │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## How to run

No build step — just open `index.html` in a browser, or serve the folder:

```powershell
# from repo root
npx serve saharat/mock
# or
python -m http.server 8080 --directory saharat/mock
```

Then open <http://localhost:8080/> (port may differ).

> **Tip:** the dev panel at the bottom-left shows live counts of mock S3/DynamoDB/SQS,
> plus a *Reset all data* button to wipe everything and start fresh.

---

## Pre-seeded accounts

| Email                  | Password   | Role     |
|------------------------|------------|----------|
| `ta@example.com`       | `password` | **TA**   |
| `student@example.com`  | `password` | **STUDENT** |

A demo lab (`Lab 01 — AWS Lambda + S3`) is also seeded so the Student dashboard
isn't empty on first load.

---

## File map

The mock uses the **same pixel-perfect design** as the production pages
(under `phurin/NewFront/`), but every page is wired to `mock-aws.js` instead
of a real AWS API. So you can demo the entire flow without any cloud account.

```
saharat/mock/
├── index.html                  Login (Cognito mock + signup)
├── Ta_Dashboard.html           TA home — labs grouped by subject
├── Ta_CreateLab.html           FLOW 1 — Create lab (full design)
├── TaLablist.html              TA's lab list per subject
├── TaViewSubmission.html       FLOW 3 — Submissions w/ AI breakdown + TA Pass/Reject
├── student_dashboard.html      Student home — courses + labs due
├── student_Lablist.html        Student's lab list per subject
├── submissionPage.html         FLOW 2 (a) — Upload screenshots (incl. blur check)
├── submissionResult.html       FLOW 2 (b) — Live polling result page
├── README.md                   This file
└── mock-aws.js                 ★ All mock AWS services + λ checkerEngine
```

---

## Mock AWS services (`mock-aws.js`)

Each service is a method namespace on the global `Mock` object.

| Real AWS service      | Mock module        | Notes                                                    |
|-----------------------|--------------------|----------------------------------------------------------|
| Cognito               | `Mock.Cognito`     | `signup / login / current / logout / requireRole`        |
| API Gateway + Lambdas | `Mock.API`         | `createLab / submitWork / listSubmissions / getResult …` |
| S3                    | `Mock.S3`          | `put / get / list / delete` (per bucket)                 |
| DynamoDB              | `Mock.DB`          | `put / get / scan / update / delete`                     |
| SQS                   | `Mock.SQS`         | `send / receive / startPoller`                           |
| Textract              | `Mock.Textract`    | `detect(imageData, expectedKeywords)` — deterministic 78% hit |
| λ checkerEngine       | `Mock._checkerEngine(submissionId)` | Pulled from SQS automatically             |

`Mock.boot()` runs on `DOMContentLoaded` and starts the SQS poller, so grading
happens automatically a few seconds after a student submits.

### Console logging

Every mock service logs a colored line, e.g.:

```
[S3] PUT TAImages/lab_xxx/slot1.png (12480 bytes)
[DynamoDB] PUT LabConfig/lab_xxx
[SQS] SEND lab-checker-queue {submissionId: "sub_yyy"}
[SQS] RECV lab-checker-queue {submissionId: "sub_yyy"}
[Lambda:checkerEngine] start sub_yyy
[Textract] detected 5 / 6 keywords
[Lambda:checkerEngine] done sub_yyy → passed 88%
```

Open the browser dev console to watch the entire flow live.

---

## Walkthrough — try the full flow

1. Open `index.html`. Log in as **TA** (`ta@example.com` / `password`).
2. Click **Create New Lab**.
   - Fill in name, subject, section, due date.
   - Upload a reference image (any PNG/JPG works).
   - Add 2-3 rules with keywords + weights summing to 100%.
   - **Add Slot** and repeat for Image 2 if you like.
   - Click **Create Lab** → toast confirms `lab_xxx` saved.
3. Log out → log in as **Student** (`student@example.com` / `password`).
4. Find the lab you just created. Click **Submit Lab**.
   - Upload one image per slot.
   - Click **Submit Work** → redirects to the **Result** page in *Submission Processing* state.
5. Watch the loader for 2-3 seconds.
   The SQS poller picks up the job, the checker engine runs Textract OCR,
   compares against rules, and stores the score. The page auto-refreshes
   to show **Submission Passed** or **Submission Rejected** with full breakdown.
6. Log out → back as **TA** → Dashboard → **View Submissions** on that lab.
   - Expand the row to see each image's checks, OCR confidence, and Textract feedback.
   - Click **Accept (Pass)** or **Reject (Review)** to override the auto-grader.

---

## Storage namespace

All mock data lives in `localStorage` under the prefix `mock.`:

```
mock.users              → user pool (Cognito)
mock.session            → currently logged-in user
mock.s3.TAImages        → reference images
mock.s3.StudentImages   → student submissions
mock.dynamo.LabConfig   → labs created by TAs
mock.dynamo.Submission  → student submissions
mock.dynamo.Score       → grading results
mock.sqs.lab-checker-queue → pending grading jobs
```

The dev panel's **Reset all data** button removes every `mock.*` key.

---

## Limitations / what's *not* mocked

- **Real OCR**: `Textract.detect` is deterministic + pseudorandom (78% hit rate per
  expected keyword), seeded by the image's first 200 chars. Same image → same result.
  Replace with the AWS Textract SDK when going live.
- **Asynchronous queue durability**: SQS messages live in `localStorage`, so they
  persist across reloads in the same browser tab/origin only.
- **Multi-user concurrency**: not simulated — one browser, one user.
- **Image storage size**: data URLs in `localStorage` cap around ~5 MB total.
  Use small screenshots for the demo.
