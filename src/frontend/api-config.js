// ── LabProject-API (HTTP API, $default stage) ─────────────────
const API_BASE = "https://0hzxan306l.execute-api.us-east-1.amazonaws.com";

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
  return {
    token,
    email: payload.email || payload["cognito:username"] || "",
    name: payload.name || payload.email || payload["cognito:username"] || "User",
    role: payload["custom:role"] || payload.role || "",
    raw: payload,
  };
}

function requireAuth(expectedRole) {
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
    source = input.name || input.email || input.username || "";
  }
  return String(source || "U")
    .split("@")[0]
    .split(/[.\s_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() || "")
    .join("") || "U";
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

function getCourseTitle(subjectId) {
  const titles = {
    "CS 232": "Computer Architecture",
    "CS232": "Computer Architecture",
    "CS 251": "Data Structures",
    "CS251": "Data Structures",
    "CS 261": "Software Engineering",
    "CS261": "Software Engineering",
    "CS 271": "Operating Systems",
    "CS271": "Operating Systems",
    "CS 301": "Cloud Computing",
    "CS301": "Cloud Computing",
  };
  return titles[subjectId] || subjectId || "Unknown Course";
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
