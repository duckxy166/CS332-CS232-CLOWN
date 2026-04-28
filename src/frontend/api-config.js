// ── LabProject-API (HTTP API, $default stage) ─────────────────
const API_BASE = "https://0hzxan306l.execute-api.us-east-1.amazonaws.com";

// ── Cognito hosted UI login — ใช้ตัวนี้แทนการฝัง URL ตรงใน HTML ─────────
const COGNITO_LOGIN_URL = "https://us-east-10rm49jitg.auth.us-east-1.amazoncognito.com/login"
  + "?client_id=4dfs5v1qsv50r1vsev1hontv9f"
  + "&response_type=token"
  + "&scope=email+openid"
  + "&redirect_uri=https://duckxy166.github.io/CS332-CS232-CLOWN/index.html";

const API_ENDPOINTS = {
  labConfig:        `${API_BASE}/lab-config`,        // POST  → lab-config Lambda
  labs:             `${API_BASE}/labs`,              // GET   → lab-lister Lambda
  referenceUpload:  `${API_BASE}/reference-upload`,  // POST  → reference-upload Lambda
  result:           `${API_BASE}/result`,            // GET   → result-reader Lambda
  submission:       `${API_BASE}/submission`,        // POST  → submission-handler Lambda
  submissions:      `${API_BASE}/submissions`,       // GET   → submission-viewer Lambda
};

// ── helper: เรียก API พร้อมแนบ Cognito token อัตโนมัติ ─────────
const AUTH_TOKEN_KEY = "cognito_id_token";

// ── Account roster — ดึงจาก roster.json แทนการฝังใน code ────────
// เพิ่ม/ลบ user แค่แก้ไฟล์ JSON ไม่ต้องแตะ JavaScript อีกต่อไป
let _rosterCache = null;
let _rosterPromise = null;

// โหลด roster จากไฟล์ JSON (fetch ครั้งเดียว แล้ว cache ไว้)
function loadRoster() {
  if (_rosterPromise) return _rosterPromise;

  // หา path ของ roster.json จากตำแหน่งของ api-config.js เอง
  // เพราะหน้าใน TA/ หรือ student/ จะ fetch ไป path ผิดถ้าใช้ relative ตรงๆ
  const scriptEl = document.querySelector('script[src$="api-config.js"]');
  const configDir = scriptEl ? scriptEl.src.replace(/[^/]*$/, '') : '';
  const rosterUrl = configDir ? configDir + 'roster.json' : 'roster.json';

  _rosterPromise = fetch(rosterUrl)
    .then(res => {
      if (!res.ok) throw new Error(`roster.json: ${res.status}`);
      return res.json();
    })
    .then(data => {
      _rosterCache = Array.isArray(data) ? data : [];
      return _rosterCache;
    })
    .catch(err => {
      console.warn('Could not load roster.json, falling back to empty roster:', err);
      _rosterCache = [];
      return _rosterCache;
    });
  return _rosterPromise;
}

// เริ่มโหลดทันทีที่ script ถูก load — ไม่ต้องรอ DOMContentLoaded
loadRoster();

function findRosterEntry(email) {
  if (!email || !_rosterCache) return null;
  const norm = String(email).trim().toLowerCase();
  return _rosterCache.find(e => e.email.toLowerCase() === norm) || null;
}

function parseJwt(token) {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(window.atob(base64).split("").map(c => {
      return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(""));
    return JSON.parse(jsonPayload);
  } catch (err) {
    return null;
  }
}

function getCurrentUser() {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  const payload = token ? parseJwt(token) : null;
  if (!payload) return null;
  const email = (payload.email || payload["cognito:username"] || "").toLowerCase();
  const roster = findRosterEntry(email);
  const cognitoRole = payload["custom:role"] || payload.role || "";
  const role = String(cognitoRole || roster?.role || "").toLowerCase();
  return {
    token,
    email,
    name: payload.name || email || "User",
    role,
    studentId: roster?.userId || "",
    classId:   roster?.classId || "",
    section:   roster?.section || "",
    roleLabel: role === "ta" ? "TA" : "Undergraduate",
    raw: payload,
  };
}

// รอให้ roster โหลดเสร็จก่อนเรียก getCurrentUser — ป้องกัน race condition
async function ensureRosterLoaded() {
  if (!_rosterCache) await loadRoster();
}

async function requireAuth(expectedRole) {
  // รอ roster โหลดก่อน เพื่อให้ได้ role/studentId ครบ
  await ensureRosterLoaded();

  const user = getCurrentUser();
  if (!user) {
    window.location.href = "../index.html";
    return null;
  }
  if (expectedRole && user.role && user.role.toLowerCase() !== expectedRole.toLowerCase()) {
    window.location.href = user.role.toLowerCase() === "ta" ? "../TA/Ta_Dashboard.html" : "../student/student_dashboard.html";
    return null;
  }
  return user;
}

function getUserInitials(input) {
  let source = input;
  if (input && typeof input === "object") {
    source = input.studentId || input.name || input.email || input.username || "";
  }
  const s = String(source || "U").trim();
  // Numeric-only input (e.g. student ID 6709650680) → first 2 digits.
  if (/^\d+$/.test(s)) return s.slice(0, 2);
  return s.split("@")[0]
    .split(/[.\s_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() || "")
    .join("") || "U";
}

// ── Shared navbar populator: replaces hardcoded "Alex Student" / "John Doe"
//    placeholders across student/TA pages with the real logged-in user.
//    Students → student ID (รหัสนักศึกษา) + "Undergraduate".
//    TAs       → email username (e.g. ta.clown01) + "TA".
function populateNavbarUser(user) {
  if (!user) return;
  const isTa = String(user.role || "").toLowerCase() === "ta";
  const emailLocal = String(user.email || "").split("@")[0];
  const display = user.studentId || (isTa ? (emailLocal || "TA") : (user.name || emailLocal || "User"));
  const role = user.roleLabel || (isTa ? "TA" : "Undergraduate");
  const initials = getUserInitials(user);
  document.querySelectorAll("[data-user-name]").forEach(el => { el.textContent = display; });
  document.querySelectorAll("[data-user-role]").forEach(el => { el.textContent = role; });
  document.querySelectorAll("[data-user-initials]").forEach(el => { el.textContent = initials; });
}

function stripDataUrl(dataUrl) {
  return String(dataUrl || "").replace(/^data:[^;]+;base64,/, "");
}

function formatDateLabel(value) {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).replace(",", " ·");
}

function buildQueryUrl(url, params = {}) {
  const target = new URL(url);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      target.searchParams.set(key, value);
    }
  });
  return target.toString();
}

function getLabId(lab) {
  return lab?.labID || lab?.labId || lab?.id || "";
}

function getLabName(lab) {
  return lab?.labName || lab?.name || lab?.title || getLabId(lab) || "Untitled Lab";
}

function getSubjectId(lab) {
  return lab?.classID || lab?.subjectId || lab?.subject || lab?.course || "Unknown";
}

function getLabSections(lab) {
  if (Array.isArray(lab?.sections)) return lab.sections;
  if (lab?.section) return [lab.section];
  return [];
}

// ── Map ของชื่อวิชา — เพิ่มได้เรื่อยๆ ไม่ต้องแก้ function ──
const _COURSE_TITLES = {
  "CS 232": "Computer Architecture",
  "CS232":  "Computer Architecture",
  "CS 251": "Data Structures",
  "CS251":  "Data Structures",
  "CS 261": "Software Engineering",
  "CS261":  "Software Engineering",
  "CS 271": "Operating Systems",
  "CS271":  "Operating Systems",
  "CS 301": "Cloud Computing",
  "CS301":  "Cloud Computing",
};

// เรียกได้ปกติ หรือจะส่ง override map จาก API ก็ได้
function getCourseTitle(subjectId, extraMap) {
  const merged = extraMap ? { ..._COURSE_TITLES, ...extraMap } : _COURSE_TITLES;
  return merged[subjectId] || subjectId || "Unknown Course";
}

function normalizeStudentStatus(submission) {
  if (!submission) return "NOT_SUBMITTED";
  const raw = String(submission.status || "").toUpperCase();
  if (raw === "PASSED") return "PASSED";
  if (raw === "REJECTED" || raw === "FAILED") return "FAILED";
  if (raw === "PENDING") return "PENDING";
  return "PENDING";
}

function normalizeTaStatus(status) {
  const raw = String(status || "").toUpperCase();
  if (raw === "PASSED") return "passed";
  if (raw === "REJECTED" || raw === "FAILED") return "rejected";
  return "pending";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function apiFetch(url, options = {}) {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: token } : {}),
    ...(options.headers || {}),
  };
  const res = await fetch(url, { ...options, headers });
  const text = await res.text().catch(() => "");
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (err) {
    data = null;
  }
  if (!res.ok) {
    const message = data?.error || text || res.statusText;
    const err = new Error(`API ${res.status}: ${message}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}
