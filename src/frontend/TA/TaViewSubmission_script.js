/* ══════════════════════════════════════════════
   taViewSubmission_script.js
   Mirrors the data-driven render pattern from
   TaDashboard_script.js for consistency.
══════════════════════════════════════════════ */

/* TA submission viewer — real backend driven */
let labData = {
  title: 'Loading…',
  section: '—',
  deadline: '—',
  description: [],
  rules: [],
};
let submissions = [];
let currentTaUser = null;
let activeLabID = '';

function getActiveLabId() {
  const params = new URLSearchParams(window.location.search);
  return params.get('lab') || params.get('labID') || '';
}

function confidenceLevel(conf) {
  const v = Number(conf || 0);
  if (v >= 0.85) return 'High';
  if (v >= 0.6)  return 'Medium';
  return 'Low';
}

function mapLabRules(lab) {
  const rules = Array.isArray(lab?.rules) ? lab.rules : [];
  return rules.map(r => ({
    type: r.pos ? 'Text + Position' : 'Text',
    requirement: r.mand ? 'mandatory' : 'optional',
    keyword: r.kw || r.keyword || '',
    weight: r.wt ?? r.weight ?? 0,
    imgId: r.imgId,
  }));
}

function mapLabMeta(lab) {
  if (!lab) return labData;
  return {
    title: getLabName(lab),
    section: getLabSections(lab).join(', ') || '—',
    deadline: lab.deadline ? formatDateLabel(lab.deadline) : '—',
    description: lab.description ? [lab.description] : [],
    rules: mapLabRules(lab),
  };
}

function mapImageResult(scoreItem, screenshot) {
  const status = normalizeTaStatus(scoreItem?.status);
  const checks = Array.isArray(scoreItem?.ruleResults)
    ? scoreItem.ruleResults.map(r => ({
        label: r.keyword,
        ok: !!r.passed,
        note: r.passed ? null : 'Missing',
      }))
    : [];
  let ai = null;
  if (scoreItem?.llmResult || scoreItem?.llmFeedback) {
    const conf = scoreItem.llmConfidence ?? scoreItem.llmResult?.confidence ?? 0;
    const confPct = Math.round(conf * 100);
    ai = {
      confidence: confPct,
      level: confidenceLevel(conf),
      text: scoreItem.llmFeedback || scoreItem.llmResult?.reason || '',
      issue: (scoreItem.llmResult?.overall || '').toUpperCase() === 'REJECTED',
    };
  } else if (scoreItem?.llmError) {
    ai = {
      confidence: 0,
      level: 'Low',
      text: `LLM check skipped: ${scoreItem.llmError}`,
      issue: false,
    };
  }
  return {
    label: `Image ${scoreItem?.imgId ?? screenshot?.imgId ?? '?'}`,
    status,
    url: screenshot?.url || null,
    refUrl: screenshot?.refUrl || null,
    checks,
    ai,
  };
}

function mapSubmission(raw) {
  const status = normalizeTaStatus(raw?.status);
  const screenshotsByImg = (raw?.screenshots || []).reduce((acc, s) => { acc[s.imgId] = s; return acc; }, {});
  const score = raw?.totalScore ?? 0;
  const scoreResult = Array.isArray(raw?.scoreResult) ? raw.scoreResult : [];
  const fallbackImages = (raw?.screenshots || []).map(s => ({ imgId: s.imgId, status: raw?.status, ruleResults: [], llmResult: null }));
  const sources = scoreResult.length ? scoreResult : fallbackImages;
  const images = sources.map(item => mapImageResult(item, screenshotsByImg[item.imgId]));
  return {
    email: raw?.email || '—',
    submissionID: raw?.submissionID || null,
    status,
    score,
    submittedAt: raw?.submittedAt ? formatDateLabel(raw.submittedAt) : '—',
    checkedAt:   raw?.checkedAt   ? formatDateLabel(raw.checkedAt)   : '—',
    images,
    raw,
  };
}

/* Empty submissions array; populated after fetch. */
const _legacySubmissionsBootstrap = [];

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

function aiFeedbackHTML(ai, status) {
  if (!ai) return '';
  const isIssue = ai.issue || status === 'rejected';
  const variant = isIssue ? 'ai-issue' : 'ai-ok';
  const levelColor =
    ai.level === 'High'   ? 'text-status-success' :
    ai.level === 'Medium' ? 'text-status-warning' :
                            'text-status-error';
  const barColor =
    ai.level === 'High'   ? 'bg-status-success' :
    ai.level === 'Medium' ? 'bg-status-warning' :
                            'bg-status-error';
  const issueBadge = isIssue
    ? '<span class="ai-issue-badge">Issue Found</span>'
    : '';

  return `
    <div class="ai-feedback ${variant}">
      <div class="ai-feedback-head">
        <div class="ai-feedback-title">
          <span class="ai-icon-bubble"><i class="ph-fill ph-robot"></i></span>
          <span class="ai-label">AI Feedback</span>
          ${issueBadge}
        </div>
        <div class="ai-confidence">
          <span class="ai-confidence-label">Confidence</span>
          <span class="ai-bar"><span class="ai-bar-fill ${barColor}" style="width:${ai.confidence}%"></span></span>
          <span class="ai-confidence-val ${levelColor}">${ai.confidence}% · ${ai.level}</span>
        </div>
      </div>
      <p class="ai-feedback-text">${ai.text}</p>
    </div>
  `;
}

function decisionFooterHTML(sub, idx) {
  const isPassed   = sub.status === 'passed';
  const isRejected = sub.status === 'rejected';
  const stateLabel =
    isPassed   ? '<span class="ta-decision-state ta-state-passed"><i class="ph-fill ph-check-circle"></i> Accepted</span>' :
    isRejected ? '<span class="ta-decision-state ta-state-rejected"><i class="ph-fill ph-flag"></i> Flagged for Review</span>' :
                 '<span class="ta-decision-state ta-state-pending"><i class="ph-fill ph-hourglass"></i> Pending</span>';
  return `
    <div class="ta-decision-footer">
      <div class="ta-decision-info">
        <i class="ph-fill ph-user-check ta-decision-icon"></i>
        <span class="ta-decision-label">TA Decision</span>
        ${stateLabel}
      </div>
      <div class="ta-decision-actions">
        <button type="button" class="ta-btn ta-btn-pass${isPassed ? ' active' : ''}"
          onclick="event.stopPropagation(); setSubmissionDecision(${idx}, 'passed')">
          <i class="ph-bold ph-check"></i> Accept (Pass)
        </button>
        <button type="button" class="ta-btn ta-btn-reject${isRejected ? ' active' : ''}"
          onclick="event.stopPropagation(); setSubmissionDecision(${idx}, 'rejected')">
          <i class="ph-bold ph-flag"></i> Reject (Review)
        </button>
      </div>
    </div>
  `;
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

  const thumbStyle = 'width:72px;height:72px;object-fit:cover;border-radius:8px;cursor:zoom-in;flex-shrink:0;border:1px solid #E2E8F0;';
  const safeLabel = img.label.replace(/'/g, "\\'");
  const studentThumb = img.url
    ? `<img src="${img.url}" alt="${img.label}" title="Click to view full size" style="${thumbStyle}" onclick="event.stopPropagation(); openLightbox('${img.url}', 'Student — ${safeLabel}')" />`
    : `<div class="thumb-placeholder"><i class="ph ph-image"></i></div>`;
  const refBtn = img.refUrl
    ? `<button type="button"
         onclick="event.stopPropagation(); openLightbox('${img.refUrl}', 'Reference — ${safeLabel}')"
         class="flex items-center justify-center gap-1 mt-1.5 px-2 py-1 rounded-md border border-layout-border bg-layout-surface hover:bg-brand-50 hover:border-brand-500 hover:text-brand-500 text-gray-500 transition-colors"
         style="width:72px;font-size:10px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;">
         <i class="ph ph-eye text-xs"></i> Ref
       </button>`
    : '';

  return `
    <div class="validation-card ${cardClass}">
      <div class="flex items-start gap-3 mb-3">
        <div class="flex flex-col items-center">
          ${studentThumb}
          ${refBtn}
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between gap-2 mb-2">
            <span class="text-p1 font-medium truncate">${img.label}</span>
            ${statusPill(img.status)}
          </div>
          <ul class="space-y-1">${checksHTML}</ul>
        </div>
      </div>
      ${aiFeedbackHTML(img.ai, img.status)}
    </div>
  `;
}

/* ────────────────────────────────────────
   LIGHTBOX (image preview)
──────────────────────────────────────── */
function openLightbox(url, caption) {
  let lb = document.getElementById('taImageLightbox');
  if (!lb) {
    lb = document.createElement('div');
    lb.id = 'taImageLightbox';
    lb.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center;flex-direction:column;gap:12px;';
    lb.onclick = closeLightbox;
    lb.innerHTML = `
      <button onclick="event.stopPropagation();closeLightbox()" style="position:absolute;top:20px;right:24px;background:none;border:none;color:#fff;font-size:32px;cursor:pointer;line-height:1;"><i class="ph ph-x-circle"></i></button>
      <img id="taLightboxImg" src="" onclick="event.stopPropagation()" style="max-width:90vw;max-height:80vh;border-radius:12px;object-fit:contain;box-shadow:0 8px 40px rgba(0,0,0,.5);" />
      <p id="taLightboxCaption" style="color:#fff;font-size:14px;font-weight:600;"></p>
    `;
    document.body.appendChild(lb);
  }
  document.getElementById('taLightboxImg').src = url;
  document.getElementById('taLightboxCaption').textContent = caption || '';
  lb.style.display = 'flex';
}

function closeLightbox() {
  const lb = document.getElementById('taImageLightbox');
  if (lb) lb.style.display = 'none';
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeLightbox();
});

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
let expandedRows = new Set(submissions.length ? [0] : []);
let currentPage = 1;
let filteredData = [...submissions];

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
            ${decisionFooterHTML(s, i)}
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
   SEARCH + FILTER + SORT PIPELINE
──────────────────────────────────────── */
const filterState = {
  query: '',
  status: 'all',        // all | passed | rejected | pending
  sortKey: null,        // email | score | submittedAt | checkedAt
  sortDir: 'asc',       // asc | desc
};

function parseDateTime(s) {
  // "26 Mar 2026 · 20:58" -> Date
  const m = (s || '').replace('·', '').replace(/\s+/g, ' ').trim();
  const d = new Date(m);
  return isNaN(d) ? 0 : d.getTime();
}

function applyPipeline(opts = {}) {
  let data = [...submissions];

  // search by email
  if (filterState.query) {
    data = data.filter(s => s.email.toLowerCase().includes(filterState.query));
  }
  // status filter
  if (filterState.status !== 'all') {
    data = data.filter(s => s.status === filterState.status);
  }
  // sort
  if (filterState.sortKey) {
    const key = filterState.sortKey;
    const dir = filterState.sortDir === 'asc' ? 1 : -1;
    data.sort((a, b) => {
      let va, vb;
      if (key === 'submittedAt' || key === 'checkedAt') {
        va = parseDateTime(a[key]); vb = parseDateTime(b[key]);
      } else if (key === 'score') {
        va = a.score; vb = b.score;
      } else {
        va = String(a[key] ?? '').toLowerCase();
        vb = String(b[key] ?? '').toLowerCase();
      }
      if (va < vb) return -1 * dir;
      if (va > vb) return  1 * dir;
      return 0;
    });
  }

  filteredData = data;
  if (!opts.preserveState) {
    currentPage  = 1;
    expandedRows = new Set();
  } else {
    const pages = Math.max(1, Math.ceil(filteredData.length / PAGE_SIZE));
    if (currentPage > pages) currentPage = pages;
  }
  const slice = filteredData.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  renderSubmissions(slice);
  renderStats(filteredData);
  renderPagination();
  updateFilterBadge();
}

function formatTimestampNow() {
  const d = new Date();
  const day = String(d.getDate()).padStart(2, '0');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  const hour = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${day} ${month} ${year} · ${hour}:${min}`;
}

function setSubmissionDecision(idx, decision) {
  const startIdx = (currentPage - 1) * PAGE_SIZE;
  const sub = filteredData[startIdx + idx];
  if (!sub) return;
  alert('TA override is not yet wired to a backend endpoint. The status from the checker engine is authoritative.');
}

function updateFilterBadge() {
  const badge = document.getElementById('filterBadge');
  if (!badge) return;
  let count = 0;
  if (filterState.status !== 'all') count++;
  if (filterState.sortKey)           count++;
  if (count > 0) {
    badge.textContent = String(count);
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

/* ── Filter dropdown toggle ── */
function toggleFilterMenu(e) {
  e.stopPropagation();
  const menu = document.getElementById('filterMenu');
  if (menu) menu.classList.toggle('hidden');
}

/* ── Apply status filter (single-select) ── */
function applyStatusFilter(status) {
  filterState.status = status;
  // update UI checkmarks
  document.querySelectorAll('.status-item').forEach(btn => {
    const check = btn.querySelector('.status-check');
    if (!check) return;
    if (btn.dataset.status === status) check.classList.remove('hidden');
    else                               check.classList.add('hidden');
  });
  applyPipeline();
}

/* ── Apply sort: click same key toggles direction ── */
function applySort(key) {
  if (filterState.sortKey === key) {
    filterState.sortDir = filterState.sortDir === 'asc' ? 'desc' : 'asc';
  } else {
    filterState.sortKey = key;
    filterState.sortDir = 'asc';
  }
  // update UI: show active key + arrow direction
  document.querySelectorAll('.sort-item').forEach(btn => {
    const dirIcon = btn.querySelector('.sort-dir');
    if (!dirIcon) return;
    const isActive = btn.dataset.key === filterState.sortKey;
    btn.classList.toggle('text-brand-500', isActive);
    btn.classList.toggle('text-brand-800', !isActive);
    dirIcon.classList.toggle('text-brand-500', isActive);
    dirIcon.classList.toggle('text-gray-400', !isActive);
    dirIcon.classList.remove('ph-arrow-up', 'ph-arrow-down');
    dirIcon.classList.add(isActive && filterState.sortDir === 'desc' ? 'ph-arrow-down' : 'ph-arrow-up');
  });
  applyPipeline();
}

/* ── Reset all filters/sort ── */
function resetFilters() {
  filterState.query = '';
  filterState.status = 'all';
  filterState.sortKey = null;
  filterState.sortDir = 'asc';
  const searchEl = document.getElementById('submissionSearch');
  if (searchEl) searchEl.value = '';
  // reset status UI
  document.querySelectorAll('.status-item').forEach(btn => {
    const check = btn.querySelector('.status-check');
    if (!check) return;
    if (btn.dataset.status === 'all') check.classList.remove('hidden');
    else                              check.classList.add('hidden');
  });
  // reset sort UI
  document.querySelectorAll('.sort-item').forEach(btn => {
    const dirIcon = btn.querySelector('.sort-dir');
    if (!dirIcon) return;
    btn.classList.remove('text-brand-500');
    btn.classList.add('text-brand-800');
    dirIcon.classList.remove('text-brand-500', 'ph-arrow-down');
    dirIcon.classList.add('text-gray-400', 'ph-arrow-up');
  });
  applyPipeline();
}

function buildLabListHref() {
  const params = new URLSearchParams(window.location.search);
  const course = params.get('course');
  return course
    ? `TaLablist.html?course=${encodeURIComponent(course)}`
    : 'TaLablist.html';
}

function buildCreateLabHref() {
  const params = new URLSearchParams(window.location.search);
  const nextParams = new URLSearchParams();
  const course = params.get('course');
  const lab = params.get('lab');
  if (course) nextParams.set('course', course);
  if (lab) nextParams.set('lab', lab);
  nextParams.set('mode', 'edit');
  const query = nextParams.toString();
  return `Ta_CreateLab.html${query ? `?${query}` : ''}`;
}

function handleEditLab() {
  window.location.href = buildCreateLabHref();
}

function handleDeleteLab() {
  if (!confirm(`Delete ${labData.title}?`)) return;
  window.location.href = buildLabListHref();
}

function handleDownloadAll() {
  const rows = [
    ['Email', 'Status', 'Score', 'Submitted At', 'Checked At'],
    ...filteredData.map(item => [item.email, item.status, item.score, item.submittedAt, item.checkedAt])
  ];

  const csv = rows
    .map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${labData.title.replace(/[^a-z0-9]+/gi, '_').toLowerCase()}_submissions.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

document.addEventListener('DOMContentLoaded', () => {
  const searchEl = document.getElementById('submissionSearch');
  if (searchEl) {
    searchEl.addEventListener('input', e => {
      filterState.query = e.target.value.trim().toLowerCase();
      applyPipeline();
    });
  }

  // close filter menu when clicking outside
  document.addEventListener('click', (e) => {
    const menu = document.getElementById('filterMenu');
    const btn  = document.getElementById('filterBtn');
    if (!menu || !btn) return;
    if (!menu.classList.contains('hidden') && !btn.contains(e.target) && !menu.contains(e.target)) {
      menu.classList.add('hidden');
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const menu = document.getElementById('filterMenu');
      if (menu) menu.classList.add('hidden');
    }
  });
});

/* ────────────────────────────────────────
   INIT
──────────────────────────────────────── */
function renderViewer() {
  const titleEl = document.getElementById('labTitle');
  const sectionEl = document.getElementById('labSection');
  const deadlineEl = document.getElementById('labDeadline');
  if (titleEl)    titleEl.textContent    = labData.title;
  if (sectionEl)  sectionEl.textContent  = labData.section;
  if (deadlineEl) deadlineEl.textContent = labData.deadline;
  document.title = `ValidMate – ${labData.title}`;
  const descEl = document.getElementById('labDescription');
  if (descEl) descEl.textContent = labData.description?.[0] || '—';

  const params = new URLSearchParams(window.location.search);
  const subjectId = params.get('subjectId') || params.get('course');
  if (subjectId) {
    document.querySelectorAll('button[onclick*="TaLablist.html"]').forEach(btn => {
      btn.setAttribute('onclick', `window.location.href='${buildLabListHref()}'`);
    });
  }

  renderRules();
  renderStats(submissions);

  // อัพเดท pass criteria badge จากข้อมูล lab จริง แทนการ hardcode 75%
  const passEl = document.getElementById('passCriteriaBadge');
  if (passEl) {
    // ลองดูว่า lab มี pass threshold กำหนดไว้ไหม ถ้าไม่มีก็ fallback 75%
    const threshold = labData.rules.length > 0
      ? labData.rules.filter(r => r.requirement === 'mandatory').reduce((sum, r) => sum + r.weight, 0) || 75
      : 75;
    passEl.textContent = `≥ ${threshold}%`;
  }

  filteredData = [...submissions];
  currentPage = 1;
  expandedRows = new Set(submissions.length ? [0] : []);
  const slice = filteredData.slice(0, PAGE_SIZE);
  renderSubmissions(slice);
  renderPagination();
}

async function loadViewer() {
  if (!currentTaUser) currentTaUser = await requireAuth('ta');
  if (!currentTaUser) return;
  populateNavbarUser(currentTaUser);
  activeLabID = getActiveLabId();
  if (!activeLabID) {
    console.error('Missing lab id in URL');
    renderViewer();
    return;
  }
  try {
    const data = await apiFetch(buildQueryUrl(API_ENDPOINTS.submissions, { labID: activeLabID }));
    if (!data?.success) throw new Error(data?.error || 'Unable to load submissions');
    submissions = (data.submissions || []).map(mapSubmission);
    if (data.lab) {
      const labMeta = await fetchFullLab(activeLabID);
      labData = mapLabMeta(labMeta || data.lab);
    } else {
      const labMeta = await fetchFullLab(activeLabID);
      labData = mapLabMeta(labMeta);
    }
    renderViewer();
  } catch (err) {
    console.error('Submission viewer load failed:', err);
    const body = document.getElementById('submissionsBody');
    if (body) {
      body.innerHTML = `
        <div class="py-12 flex flex-col items-center justify-center text-gray-400 border-t border-layout-border">
          <div class="flex items-center gap-2 text-status-error text-p1 font-semibold mb-1">
            <i class="ph-fill ph-warning-circle"></i>
            <span>Failed to load submissions</span>
          </div>
          <p class="text-p2 text-gray-400">${escapeHtml(err.message || 'Unknown error')}</p>
          <button onclick="loadViewer()" class="mt-4 inline-flex items-center gap-2 rounded-lg border border-layout-border bg-layout-surface px-4 py-2 text-btn text-brand-800 hover:border-brand-500 hover:text-brand-500 transition-colors">
            <i class="ph ph-arrow-counter-clockwise text-sm"></i> Try again
          </button>
        </div>`;
    }
  }
}

async function fetchFullLab(labID) {
  try {
    const data = await apiFetch(API_ENDPOINTS.labs);
    if (!data?.success) return null;
    return (data.labs || []).find(l => getLabId(l) === labID) || null;
  } catch (err) {
    console.warn('Could not fetch lab list', err);
    return null;
  }
}

loadViewer();