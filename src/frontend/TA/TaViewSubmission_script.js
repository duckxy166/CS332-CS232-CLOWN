/* ══════════════════════════════════════════════
   taViewSubmission_script.js
   Mirrors the data-driven render pattern from
   TaDashboard_script.js for consistency.
══════════════════════════════════════════════ */

/* ── Lab Meta ── */
const labData = {
  title:    "Cloud Storage Setup",
  section:  "650001",
  deadline: "16 Mar 2026",
  description: [
    "Configure AWS Lambda to receive S3 events",
    "Write Node.js code to extract bucketName and validate file extensions (.jpg, .png)",
    "Ensure correct IAM role permissions are attached to the function",
  ],
  rules: [
    { type: "Text",           requirement: "mandatory", keyword: "Successfully", weight: 40 },
    { type: "Text + Position",requirement: "optional",  keyword: "Lambda",       weight: 40 },
    { type: "Text",           requirement: "optional",  keyword: "index",        weight: 20 },
  ],
};

/* ── Submissions Data ── */
const submissions = [
  {
    email: "phonpawee.sae@dome.tu.ac.th",
    status: "passed",
    score: 100,
    submittedAt: "26 Mar 2026 · 20:58",
    checkedAt:   "26 Mar 2026 · 20:58",
    images: [
      { label: "Image 1", status: "passed", checks: [
        { label: "Successfully", ok: true },
        { label: "Lambda",       ok: true },
        { label: "index",        ok: true },
      ]},
      { label: "Image 2", status: "passed", checks: [
        { label: "Buckets", ok: true },
        { label: "Upload",  ok: true },
        { label: "Objects", ok: true },
      ]},
    ],
  },
  {
    email: "saharat.udo@dome.tu.ac.th",
    status: "rejected",
    score: 60,
    submittedAt: "26 Mar 2026 · 21:05",
    checkedAt:   "26 Mar 2026 · 21:05",
    images: [
      { label: "Image 1", status: "passed", checks: [
        { label: "Successfully", ok: true },
        { label: "Lambda",       ok: true },
        { label: "index",        ok: true },
      ]},
      { label: "Image 2", status: "rejected", checks: [
        { label: "Buckets", ok: true },
        { label: "Upload",  ok: false, note: "Missing" },
        { label: "Objects", ok: true },
      ]},
    ],
  },
  {
    email: "paeng.hom@dome.tu.ac.th",
    status: "passed",
    score: 100,
    submittedAt: "26 Mar 2026 · 21:12",
    checkedAt:   "26 Mar 2026 · 21:12",
    images: [
      { label: "Image 1", status: "passed", checks: [
        { label: "Successfully", ok: true },
        { label: "Lambda",       ok: true },
        { label: "index",        ok: true },
      ]},
      { label: "Image 2", status: "passed", checks: [
        { label: "Buckets", ok: true },
        { label: "Upload",  ok: true },
        { label: "Objects", ok: true },
      ]},
    ],
  },
  {
    email: "nattawut.kri@dome.tu.ac.th",
    status: "rejected",
    score: 40,
    submittedAt: "26 Mar 2026 · 21:30",
    checkedAt:   "26 Mar 2026 · 21:31",
    images: [
      { label: "Image 1", status: "rejected", checks: [
        { label: "Successfully", ok: false, note: "Missing" },
        { label: "Lambda",       ok: true },
        { label: "index",        ok: false, note: "Not found" },
      ]},
      { label: "Image 2", status: "rejected", checks: [
        { label: "Buckets", ok: true },
        { label: "Upload",  ok: false, note: "Missing" },
        { label: "Objects", ok: false, note: "Missing" },
      ]},
    ],
  },
  {
    email: "supalak.wan@dome.tu.ac.th",
    status: "passed",
    score: 80,
    submittedAt: "26 Mar 2026 · 21:44",
    checkedAt:   "26 Mar 2026 · 21:44",
    images: [
      { label: "Image 1", status: "passed", checks: [
        { label: "Successfully", ok: true },
        { label: "Lambda",       ok: true },
        { label: "index",        ok: false, note: "Missing" },
      ]},
      { label: "Image 2", status: "passed", checks: [
        { label: "Buckets", ok: true },
        { label: "Upload",  ok: true },
        { label: "Objects", ok: true },
      ]},
    ],
  }
];

/* ────────────────────────────────────────
   HELPERS
──────────────────────────────────────── */
function statusPill(status) {
  const map = {
    passed:   '<span class="pill-passed">Passed</span>',
    rejected: '<span class="pill-rejected">Rejected</span>',
    pending:  '<span class="pill-pending">Pending</span>',
  };
  return map[status] ?? '';
}

function rowAccent(status) {
  const map = { passed: 'row-passed', rejected: 'row-rejected', pending: 'row-pending' };
  return map[status] ?? '';
}

function checkIcon(ok) {
  return ok
    ? `<i class="ph-bold ph-check text-status-success text-xs flex-shrink-0"></i>`
    : `<i class="ph-bold ph-x text-status-error text-xs flex-shrink-0"></i>`;
}

function imageCardHTML(img) {
  const isPass = img.status === 'passed';
  const cardClass = img.status === 'passed' ? 'vc-passed' : img.status === 'pending' ? 'vc-pending' : 'vc-rejected';
  const checksHTML = img.checks.map(c => `
    <li class="check-item ${c.ok ? 'text-status-success' : 'text-status-error'}">
      ${checkIcon(c.ok)}
      <span class="text-brand-800">${c.label}</span>
      ${!c.ok && c.note ? `<span class="text-xs text-gray-400 italic ml-1">(${c.note})</span>` : ''}
    </li>
  `).join('');

  return `
    <div class="validation-card ${cardClass}">
      <div class="flex items-center justify-between mb-3">
        <span class="text-p1 font-semibold text-brand-800">${img.label}</span>
        ${statusPill(img.status)}
      </div>
      <!-- Thumbnail placeholder (replaces screenshot image) -->
      <div class="thumb-placeholder mb-3">
        <i class="ph ph-image"></i>
      </div>
      <ul class="space-y-1.5">${checksHTML}</ul>
    </div>
  `;
}

/* ────────────────────────────────────────
   RENDER: Rules Table
──────────────────────────────────────── */
function renderRules() {
  const tbody = document.getElementById('rulesTable');
  if (!tbody) return;

  tbody.innerHTML = labData.rules.map(r => {
    const reqBadge = r.requirement === 'mandatory'
      ? '<span class="badge-mandatory">Mandatory</span>'
      : '<span class="badge-optional">Optional</span>';

    const typeIcon = r.type.includes('Position')
      ? '<i class="ph-fill ph-grid-four text-xs"></i>'
      : '<i class="ph-fill ph-text-t text-xs"></i>';

    return `
      <tr class="hover:bg-layout-bg transition-colors">
        <td><span class="rule-chip">${typeIcon} ${r.type}</span></td>
        <td>${reqBadge}</td>
        <td class="font-semibold">${r.keyword}</td>
        <td class="text-right font-bold">${r.weight}%</td>
      </tr>
    `;
  }).join('');
}

/* ────────────────────────────────────────
   RENDER: Stat Cards
──────────────────────────────────────── */
function renderStats(data) {
  const total    = data.length;
  const passed   = data.filter(s => s.status === 'passed').length;
  const rejected = data.filter(s => s.status === 'rejected').length;
  const pending  = data.filter(s => s.status === 'pending').length;

  document.getElementById('statTotal').textContent    = total;
  document.getElementById('statPassed').textContent   = passed;
  document.getElementById('statRejected').textContent = rejected;
  document.getElementById('statPending').textContent  = pending;
}

/* ────────────────────────────────────────
   RENDER: Submission Rows
──────────────────────────────────────── */
let expandedRows = new Set([0, 1]); // default: first two expanded

function renderSubmissions(data) {
  const body = document.getElementById('submissionsBody');
  if (!body) return;

  if (data.length === 0) {
    body.innerHTML = `
      <div class="py-12 flex flex-col items-center justify-center text-gray-400 border-t border-layout-border">
        <i class="ph-fill ph-magnifying-glass text-4xl mb-2 text-gray-300"></i>
        <p class="text-p1 font-semibold">No submissions found</p>
      </div>`;
    return;
  }

  body.innerHTML = data.map((s, i) => {
    const isOpen = expandedRows.has(i);
    const breakdownHTML = s.images.map(img => imageCardHTML(img)).join('');

    return `
      <div class="border-b border-layout-border last:border-b-0" id="submission-row-${i}">

        <!-- Main row -->
        <div class="submission-row-grid px-4 py-3.5 cursor-pointer transition-colors ${rowAccent(s.status)}"
             onclick="toggleRow(${i})">
          <span class="text-p2 text-gray-400 font-semibold">${i + 1}</span>
          <span class="text-p1 font-medium truncate">${s.email}</span>
          <span class="text-center">${statusPill(s.status)}</span>
          <span class="text-center font-bold text-p1 ${s.status === 'passed' ? 'text-status-success' : s.status === 'rejected' ? 'text-status-error' : 'text-status-warning'}">${s.score}%</span>
          <span class="text-p2 text-gray-400">${s.submittedAt}</span>
          <span class="text-p2 text-gray-400">${s.checkedAt}</span>
          <span class="flex justify-center">
            <i class="ph ph-caret-up chevron-icon text-gray-400 text-sm ${isOpen ? 'open' : ''}" id="chevron-${i}"></i>
          </span>
        </div>

        <!-- Validation Breakdown -->
        <div class="breakdown-panel ${isOpen ? 'open' : ''}" id="breakdown-${i}">
          <div class="px-5 pb-5 pt-1">
            <p class="text-p2 text-gray-400 font-bold uppercase tracking-widest mb-3">Validation Breakdown</p>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              ${breakdownHTML}
            </div>
          </div>
        </div>

      </div>
    `;
  }).join('');
}

/* ────────────────────────────────────────
   TOGGLE ROW
──────────────────────────────────────── */
function toggleRow(i) {
  const panel   = document.getElementById(`breakdown-${i}`);
  const chevron = document.getElementById(`chevron-${i}`);
  if (!panel) return;

  if (expandedRows.has(i)) {
    expandedRows.delete(i);
    panel.classList.remove('open');
    chevron.classList.remove('open');
  } else {
    expandedRows.add(i);
    panel.classList.add('open');
    chevron.classList.add('open');
  }
}

/* ────────────────────────────────────────
   PAGINATION (client-side, simple)
──────────────────────────────────────── */
const PAGE_SIZE = 5;
let currentPage = 1;
let filteredData = [...submissions];

function renderPagination() {
  const total = filteredData.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const start = (currentPage - 1) * PAGE_SIZE + 1;
  const end   = Math.min(currentPage * PAGE_SIZE, total);

  document.getElementById('paginationLabel').textContent =
    total === 0 ? 'No entries' : `Showing ${start} to ${end} of ${total} entries`;

  const ctrl = document.getElementById('paginationControls');
  ctrl.innerHTML = `
    <button class="page-btn" onclick="changePage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>Prev</button>
    ${Array.from({ length: pages }, (_, p) => `
      <button class="page-btn ${p + 1 === currentPage ? 'active' : ''}" onclick="changePage(${p + 1})">${p + 1}</button>
    `).join('')}
    <button class="page-btn" onclick="changePage(${currentPage + 1})" ${currentPage === pages ? 'disabled' : ''}>Next</button>
  `;
}

function changePage(p) {
  const pages = Math.max(1, Math.ceil(filteredData.length / PAGE_SIZE));
  if (p < 1 || p > pages) return;
  currentPage = p;
  const slice = filteredData.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  renderSubmissions(slice);
  renderPagination();
}

/* ────────────────────────────────────────
   SEARCH
──────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  const searchEl = document.getElementById('submissionSearch');
  if (searchEl) {
    searchEl.addEventListener('input', e => {
      const q = e.target.value.trim().toLowerCase();
      filteredData = submissions.filter(s => s.email.toLowerCase().includes(q));
      currentPage  = 1;
      expandedRows = new Set();
      const slice  = filteredData.slice(0, PAGE_SIZE);
      renderSubmissions(slice);
      renderStats(filteredData);
      renderPagination();
    });
  }
});

/* ────────────────────────────────────────
   INIT
──────────────────────────────────────── */
(function init() {
  // Lab meta
  document.getElementById('labTitle').textContent    = labData.title;
  document.getElementById('labSection').textContent  = labData.section;
  document.getElementById('labDeadline').textContent = labData.deadline;

  renderRules();
  renderStats(submissions);

  filteredData = [...submissions];
  const slice  = filteredData.slice(0, PAGE_SIZE);
  renderSubmissions(slice);
  renderPagination();
})();