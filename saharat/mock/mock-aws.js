/* ══════════════════════════════════════════════════════════════
   mock-aws.js
   Simulates the AWS serverless backend from the architecture diagram:
     • Cognito (auth)
     • API Gateway (request routing)
     • Lambda functions (referenceUpload, labConfig, submissionHandler,
                         checkerEngine, resultReader, submissionViewer)
     • S3 buckets (TAImages, StudentImages)
     • DynamoDB tables (LabConfig, Submission, Score)
     • SQS queue (lab-checker-queue)
     • Textract (OCR mock)
   Persistence: localStorage (key prefix: "mock.")
══════════════════════════════════════════════════════════════ */

const Mock = (function () {
  const NS = 'mock.';
  const log = (svc, ...a) => console.log(`%c[${svc}]`, 'color:#4F46E5;font-weight:bold', ...a);

  // ── localStorage helpers ──────────────────────────────────────
  const lsGet = (k, fb) => {
    try { return JSON.parse(localStorage.getItem(NS + k)) ?? fb; }
    catch { return fb; }
  };
  const lsSet = (k, v) => localStorage.setItem(NS + k, JSON.stringify(v));
  const lsDel = (k) => localStorage.removeItem(NS + k);
  const uid = (p = 'id') => `${p}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // ══════════════════════════════════════════════════════════════
  // COGNITO  — auth + user pool
  // ══════════════════════════════════════════════════════════════
  const Cognito = {
    signup(email, password, role, fullName) {
      const users = lsGet('users', {});
      if (users[email]) throw new Error('User already exists');
      const u = { id: uid('u'), email, password, role, fullName, createdAt: Date.now() };
      users[email] = u;
      lsSet('users', users);
      log('Cognito', 'signup', email, role);
      return u;
    },
    login(email, password) {
      const users = lsGet('users', {});
      const u = users[email];
      if (!u || u.password !== password) throw new Error('Invalid email or password');
      const session = { token: 'tok_' + btoa(`${email}:${Date.now()}`), user: u, ts: Date.now() };
      lsSet('session', session);
      log('Cognito', 'login', email);
      return session;
    },
    current() { return lsGet('session', null); },
    logout() { lsDel('session'); log('Cognito', 'logout'); },
    requireRole(role) {
      const s = Cognito.current();
      if (!s) { window.location.href = relPath('index.html'); throw new Error('Not authenticated'); }
      if (role && s.user.role !== role) { window.location.href = relPath('index.html'); throw new Error('Wrong role'); }
      return s;
    }
  };

  // ══════════════════════════════════════════════════════════════
  // S3  — bucket/object storage (data is base64 dataURL or string)
  // ══════════════════════════════════════════════════════════════
  const S3 = {
    put(bucket, key, data) {
      const b = lsGet(`s3.${bucket}`, {});
      b[key] = { data, size: (data || '').length, uploadedAt: Date.now() };
      lsSet(`s3.${bucket}`, b);
      log('S3', 'PUT', `${bucket}/${key}`, `(${b[key].size} bytes)`);
      return `s3://${bucket}/${key}`;
    },
    get(bucket, key) {
      const b = lsGet(`s3.${bucket}`, {});
      return b[key]?.data ?? null;
    },
    list(bucket, prefix = '') {
      const b = lsGet(`s3.${bucket}`, {});
      return Object.keys(b).filter(k => k.startsWith(prefix));
    },
    delete(bucket, key) {
      const b = lsGet(`s3.${bucket}`, {});
      delete b[key];
      lsSet(`s3.${bucket}`, b);
    }
  };

  // ══════════════════════════════════════════════════════════════
  // DYNAMODB  — simple key-value tables (PK = item.id)
  // ══════════════════════════════════════════════════════════════
  const DB = {
    put(table, item) {
      if (!item.id) item.id = uid(table.toLowerCase());
      const t = lsGet(`dynamo.${table}`, {});
      t[item.id] = item;
      lsSet(`dynamo.${table}`, t);
      log('DynamoDB', 'PUT', `${table}/${item.id}`);
      return item;
    },
    get(table, id) {
      const t = lsGet(`dynamo.${table}`, {});
      return t[id] || null;
    },
    scan(table, filterFn) {
      const t = lsGet(`dynamo.${table}`, {});
      const items = Object.values(t);
      return filterFn ? items.filter(filterFn) : items;
    },
    update(table, id, patch) {
      const t = lsGet(`dynamo.${table}`, {});
      if (!t[id]) return null;
      t[id] = { ...t[id], ...patch };
      lsSet(`dynamo.${table}`, t);
      return t[id];
    },
    delete(table, id) {
      const t = lsGet(`dynamo.${table}`, {});
      delete t[id];
      lsSet(`dynamo.${table}`, t);
    }
  };

  // ══════════════════════════════════════════════════════════════
  // SQS  — FIFO queue with poller
  // ══════════════════════════════════════════════════════════════
  const SQS = {
    send(queue, message) {
      const q = lsGet(`sqs.${queue}`, []);
      const msg = { id: uid('msg'), body: message, ts: Date.now() };
      q.push(msg);
      lsSet(`sqs.${queue}`, q);
      log('SQS', 'SEND', queue, message);
      return msg;
    },
    receive(queue) {
      const q = lsGet(`sqs.${queue}`, []);
      if (q.length === 0) return null;
      const msg = q.shift();
      lsSet(`sqs.${queue}`, q);
      return msg;
    },
    peek(queue) { return lsGet(`sqs.${queue}`, []); },
    startPoller(queue, handler, intervalMs = 2500) {
      log('SQS', 'poller started for', queue);
      return setInterval(async () => {
        const msg = SQS.receive(queue);
        if (msg) {
          log('SQS', 'RECV', queue, msg.body);
          try { await handler(msg.body, msg); }
          catch (err) { console.error('[SQS] handler error', err); }
        }
      }, intervalMs);
    }
  };

  // ══════════════════════════════════════════════════════════════
  // TEXTRACT  — OCR mock. In real life this calls AWS Textract on
  // an S3 image. Here we simulate keyword detection deterministically
  // so the same image yields the same result.
  // We seed an "expected keyword pool" per image based on its hash,
  // and a 75% chance each lab keyword is "found".
  // ══════════════════════════════════════════════════════════════
  const Textract = {
    // aiGrading=true  → fuzzy/lenient match (~78% of keywords expected to hit)
    // aiGrading=false → strict exact match (~55% hit, lower tolerance)
    detect(imageData, expectedKeywords = [], aiGrading = true) {
      // Simple hash of the image data
      let h = 0;
      const sample = (imageData || '').slice(0, 200);
      for (let i = 0; i < sample.length; i++) {
        h = ((h << 5) - h + sample.charCodeAt(i)) | 0;
      }
      const threshold = aiGrading ? 0.78 : 0.55;
      const found = [];
      const missing = [];
      for (const kw of expectedKeywords) {
        const seed = Math.abs(h ^ hashStr(kw));
        const p = (seed % 100) / 100; // [0,1)
        if (p < threshold) found.push({ keyword: kw, confidence: 70 + (seed % 30) });
        else missing.push({ keyword: kw, confidence: 0 });
      }
      const overallConf = found.length === 0 ? 0
        : Math.round(found.reduce((s, x) => s + x.confidence, 0) / found.length);
      log('Textract', aiGrading ? 'AI' : 'Strict', 'detected', found.length, '/', expectedKeywords.length, 'keywords');
      return { found, missing, confidence: overallConf };
    }
  };
  function hashStr(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    return h;
  }

  // ══════════════════════════════════════════════════════════════
  // LAMBDA: checkerEngine
  // Pulled from SQS, runs OCR via Textract, compares with the
  // lab's reference rules, computes score, saves to DynamoDB.
  // ══════════════════════════════════════════════════════════════
  async function checkerEngine(submissionId) {
    log('Lambda:checkerEngine', 'start', submissionId);
    const sub = DB.get('Submission', submissionId);
    if (!sub) { log('Lambda:checkerEngine', 'submission not found'); return; }
    const lab = DB.get('LabConfig', sub.labId);
    if (!lab) { log('Lambda:checkerEngine', 'lab not found'); return; }

    const slotResults = [];
    let totalScore = 0;

    for (const slot of lab.slots) {
      const submitted = sub.images.find(i => i.slot === slot.slot);
      if (!submitted) {
        slotResults.push({ slot: slot.slot, score: 0, status: 'rejected', checks: [], confidence: 0, reason: 'no image submitted' });
        continue;
      }
      const imgData = S3.get('StudentImages', submitted.s3Key);
      const expected = slot.rules.map(r => r.keyword);
      const aiGrading = lab.thresholds?.aiGrading !== false; // default On
      const ocr = Textract.detect(imgData, expected, aiGrading);

      const foundSet = new Set(ocr.found.map(f => f.keyword));
      let slotScore = 0;
      let mandatoryFailed = false;
      const checks = slot.rules.map(rule => {
        const ok = foundSet.has(rule.keyword);
        if (ok) slotScore += rule.weight;
        else if (rule.mandatory) mandatoryFailed = true;
        return { keyword: rule.keyword, ok, weight: rule.weight, mandatory: rule.mandatory };
      });

      const slotPassed = slotScore >= (lab.thresholds.minScore || 75) && !(lab.thresholds.mustPassMandatory && mandatoryFailed);
      slotResults.push({
        slot: slot.slot,
        score: slotScore,
        status: slotPassed ? 'passed' : 'rejected',
        checks,
        confidence: ocr.confidence,
        mandatoryFailed
      });
      totalScore += slotScore;
    }

    const avgScore = lab.slots.length === 0 ? 0 : Math.round(totalScore / lab.slots.length);
    const passed = avgScore >= (lab.thresholds.minScore || 75)
      && !(lab.thresholds.mustPassMandatory && slotResults.some(r => r.mandatoryFailed));

    const score = {
      id: 'sc_' + submissionId,
      submissionId,
      labId: sub.labId,
      score: avgScore,
      status: passed ? 'passed' : 'rejected',
      slots: slotResults,
      checkedAt: new Date().toISOString()
    };
    DB.put('Score', score);

    DB.update('Submission', submissionId, {
      status: passed ? 'passed' : 'rejected',
      score: avgScore,
      checkedAt: score.checkedAt
    });

    log('Lambda:checkerEngine', 'done', submissionId, '→', score.status, score.score + '%');
    return score;
  }

  // ══════════════════════════════════════════════════════════════
  // API GATEWAY  —  the only public surface. Each method maps to
  // a Lambda function shown in the diagram.
  // ══════════════════════════════════════════════════════════════
  const API = {
    // FLOW 1 — TA creates a lab
    // λ referenceUpload + λ labConfig
    async createLab(payload) {
      const labId = uid('lab');
      // λ referenceUpload  →  S3 (TAImages)
      const slots = payload.slots.map(s => {
        if (s.image) S3.put('TAImages', `${labId}/slot${s.slot}.png`, s.image);
        return {
          slot: s.slot,
          imageKey: s.image ? `${labId}/slot${s.slot}.png` : null,
          rules: s.rules
        };
      });
      // λ labConfig  →  DynamoDB (LabConfig)
      const item = {
        id: labId,
        labName: payload.labName,
        labDescription: payload.labDescription || '',
        sections: payload.sections || [],
        subjectId: payload.subjectId || '',
        deadline: payload.deadline,
        slots,
        thresholds: payload.thresholds || { minScore: 75, mustPassMandatory: false },
        createdBy: payload.createdBy || 'TA',
        createdAt: new Date().toISOString()
      };
      DB.put('LabConfig', item);
      log('API', 'POST /labs →', labId);
      return { success: true, labId };
    },
    listLabs(filters = {}) {
      return DB.scan('LabConfig').sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    },
    getLab(labId) { return DB.get('LabConfig', labId); },
    deleteLab(labId) {
      const lab = DB.get('LabConfig', labId);
      if (!lab) return false;
      // cascade delete: ref images, submissions, scores
      lab.slots.forEach(s => s.imageKey && S3.delete('TAImages', s.imageKey));
      DB.scan('Submission', s => s.labId === labId).forEach(s => {
        s.images.forEach(i => S3.delete('StudentImages', i.s3Key));
        DB.delete('Score', 'sc_' + s.id);
        DB.delete('Submission', s.id);
      });
      DB.delete('LabConfig', labId);
      return true;
    },

    // FLOW 2 — Student submits work
    // λ submissionHandler  →  S3 + DynamoDB + SQS enqueue
    async submitWork(payload) {
      const submissionId = uid('sub');
      const images = payload.images.map(img => {
        S3.put('StudentImages', `${submissionId}/slot${img.slot}.png`, img.data);
        return { slot: img.slot, s3Key: `${submissionId}/slot${img.slot}.png` };
      });
      const submission = {
        id: submissionId,
        labId: payload.labId,
        studentEmail: payload.studentEmail,
        studentName: payload.studentName || payload.studentEmail,
        images,
        status: 'pending',
        score: null,
        submittedAt: new Date().toISOString(),
        checkedAt: null
      };
      DB.put('Submission', submission);
      // enqueue SQS job  →  λ checkerEngine
      SQS.send('lab-checker-queue', { submissionId });
      log('API', 'POST /submissions →', submissionId);
      return { success: true, submissionId };
    },

    // FLOW 2 — Student polls for result
    // λ resultReader
    getResult(submissionId) {
      const sub = DB.get('Submission', submissionId);
      if (!sub) return null;
      const score = DB.get('Score', 'sc_' + submissionId);
      return { submission: sub, score };
    },
    getMyLatestSubmission(studentEmail, labId) {
      const subs = DB.scan('Submission', s => s.studentEmail === studentEmail && s.labId === labId);
      if (subs.length === 0) return null;
      return subs.sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || ''))[0];
    },

    // FLOW 3 — TA views submissions
    // λ submissionViewer
    listSubmissions(labId) {
      const subs = DB.scan('Submission', s => s.labId === labId);
      return subs.map(s => ({ ...s, scoreDetail: DB.get('Score', 'sc_' + s.id) }))
                 .sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || ''));
    },
    setTaDecision(submissionId, decision) {
      // TA override: 'passed' | 'rejected'
      DB.update('Submission', submissionId, {
        status: decision,
        taDecidedAt: new Date().toISOString(),
        taOverride: true
      });
      return DB.get('Submission', submissionId);
    },

    // Diagnostics  (for the dev panel)
    listMySubmissions(studentEmail) {
      return DB.scan('Submission', s => s.studentEmail === studentEmail)
               .sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || ''));
    },
    queueDepth() { return SQS.peek('lab-checker-queue').length; }
  };

  // ══════════════════════════════════════════════════════════════
  // BOOT  — seed demo data + start the SQS poller (checkerEngine)
  // ══════════════════════════════════════════════════════════════
  let pollerHandle = null;
  function boot() {
    seedIfEmpty();
    if (!pollerHandle) {
      pollerHandle = SQS.startPoller('lab-checker-queue', async (body) => {
        await checkerEngine(body.submissionId);
      });
    }
  }
  function seedIfEmpty() {
    const users = lsGet('users', {});
    if (Object.keys(users).length === 0) {
      Cognito.signup('ta@example.com',      'password', 'TA',      'John TA');
      Cognito.signup('student@example.com', 'password', 'STUDENT', 'Alex Student');
    }
    const labs = lsGet('dynamo.LabConfig', {});
    if (Object.keys(labs).length === 0) {
      DB.put('LabConfig', {
        id: 'lab_seed_aws_lambda',
        labName: 'Lab 01 — AWS Lambda + S3',
        labDescription: 'Configure an AWS Lambda to process S3 events. Submit screenshots showing successful Lambda execution and S3 bucket creation.',
        sections: ['650001'],
        subjectId: 'CS 232',
        deadline: new Date(Date.now() + 7 * 86400000).toISOString(),
        slots: [
          { slot: 1, imageKey: null, rules: [
            { keyword: 'Successfully', weight: 50, mandatory: true },
            { keyword: 'Lambda',       weight: 30, mandatory: false },
            { keyword: 'index',        weight: 20, mandatory: false }
          ]},
          { slot: 2, imageKey: null, rules: [
            { keyword: 'Buckets', weight: 40, mandatory: true },
            { keyword: 'Upload',  weight: 30, mandatory: false },
            { keyword: 'Objects', weight: 30, mandatory: false }
          ]}
        ],
        thresholds: { minScore: 75, mustPassMandatory: true, aiGrading: true },
        createdBy: 'ta@example.com',
        createdAt: new Date(Date.now() - 86400000).toISOString()
      });
      DB.put('LabConfig', {
        id: 'lab_seed_dynamodb',
        labName: 'Lab 02 — DynamoDB CRUD',
        labDescription: 'Create a DynamoDB table and demonstrate CRUD operations via AWS console. Submit screenshots of the table, PutItem result, and Query result.',
        sections: ['650001'],
        subjectId: 'CS 232',
        deadline: new Date(Date.now() + 3 * 86400000).toISOString(),
        slots: [
          { slot: 1, imageKey: null, rules: [
            { keyword: 'Tables',     weight: 50, mandatory: true },
            { keyword: 'Active',     weight: 30, mandatory: false },
            { keyword: 'partition',  weight: 20, mandatory: false }
          ]},
          { slot: 2, imageKey: null, rules: [
            { keyword: 'PutItem', weight: 60, mandatory: true },
            { keyword: 'success', weight: 40, mandatory: false }
          ]}
        ],
        thresholds: { minScore: 70, mustPassMandatory: true, aiGrading: true },
        createdBy: 'ta@example.com',
        createdAt: new Date(Date.now() - 2 * 86400000).toISOString()
      });
      DB.put('LabConfig', {
        id: 'lab_seed_linkedlist',
        labName: 'Lab 01 — Linked List Implementation',
        labDescription: 'Implement singly linked list with insert/delete/traverse. Submit screenshots of test runs.',
        sections: ['650001'],
        subjectId: 'CS 251',
        deadline: new Date(Date.now() + 5 * 86400000).toISOString(),
        slots: [
          { slot: 1, imageKey: null, rules: [
            { keyword: 'PASS',     weight: 60, mandatory: true },
            { keyword: 'tests',    weight: 25, mandatory: false },
            { keyword: 'inserted', weight: 15, mandatory: false }
          ]}
        ],
        thresholds: { minScore: 75, mustPassMandatory: true, aiGrading: true },
        createdBy: 'ta@example.com',
        createdAt: new Date(Date.now() - 3 * 86400000).toISOString()
      });
    }
  }

  // ── helper for relative paths between pages in this folder
  function relPath(p) {
    const here = window.location.pathname;
    const inSub = here.includes('/ta/') || here.includes('/student/');
    return inSub ? '../' + p : p;
  }

  // Wipe all mock data and re-seed (for demo recovery)
  function resetDemo() {
    Object.keys(localStorage).filter(k => k.startsWith(NS)).forEach(k => localStorage.removeItem(k));
    log('resetDemo', 'cleared all mock.* keys');
    boot();
  }

  return { Cognito, S3, DB, SQS, Textract, API, boot, resetDemo, _checkerEngine: checkerEngine, _NS: NS };
})();

// Boot immediately (synchronously) so any script that loads after mock-aws.js
// can call Mock.API.* without waiting for DOMContentLoaded.
Mock.boot();
