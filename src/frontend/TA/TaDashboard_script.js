 /* TA dashboard — real backend driven */
let courses = [];
let currentTaUser = null;

const COURSE_PALETTE = [
  { color: 'indigo-500', lightColor: 'indigo-50' },
  { color: 'blue-500',   lightColor: 'blue-50' },
  { color: 'emerald-500',lightColor: 'emerald-50' },
  { color: 'amber-500',  lightColor: 'amber-50' },
  { color: 'pink-500',   lightColor: 'pink-50' },
];

/* ── Sort state ── */
let viewFilter = 'done';
let sortState = { key: null, dir: 'asc' }; // key: 'code' | 'totalLabs' | 'progress'
const sortLabels = { code: 'Course', totalLabs: 'Total Labs', progress: 'Progress' };

function updateDashboardFilterButtons() {
  const pendingBtn = document.getElementById('pendingFilterBtn');
  const doneBtn = document.getElementById('doneFilterBtn');
  if (!pendingBtn || !doneBtn) return;

  const setActive = (btn, active) => {
    btn.classList.toggle('bg-brand-900', active);
    btn.classList.toggle('text-white', active);
    btn.classList.toggle('font-bold', active);
    btn.classList.toggle('text-gray-600', !active);
    btn.classList.toggle('hover:text-brand-800', !active);
    btn.classList.toggle('font-semibold', !active);
    btn.classList.toggle('border', !active);
    btn.classList.toggle('border-gray-300', !active);
  };

  setActive(pendingBtn, viewFilter === 'pending');
  setActive(doneBtn, viewFilter === 'done');
}

function setDashboardFilter(filter) {
  viewFilter = filter;
  updateDashboardFilterButtons();
  renderGrid(document.getElementById('searchInput').value);
}

function applySort(key) {
  if (sortState.key === key) {
    sortState.dir = sortState.dir === 'asc' ? 'desc' : 'asc';
  } else {
    sortState = { key, dir: 'asc' };
  }
  updateFilterLabel();
  renderGrid(document.getElementById('searchInput').value);
  closeFilterMenu();
}

function resetSort() {
  sortState = { key: null, dir: 'asc' };
  updateFilterLabel();
  renderGrid(document.getElementById('searchInput').value);
  closeFilterMenu();
}

function updateFilterLabel() {
  const label = document.getElementById('filterLabel');
  if (!label) return;
  if (!sortState.key) {
    label.textContent = 'Filter';
  } else {
    const arrow = sortState.dir === 'asc' ? '↑' : '↓';
    label.textContent = `${sortLabels[sortState.key]} ${arrow}`;
  }
  // Update the arrow icon in the dropdown items
  document.querySelectorAll('.sort-item').forEach(btn => {
    const icon = btn.querySelector('.sort-dir');
    const isActive = btn.dataset.key === sortState.key;
    if (!icon) return;
    icon.classList.toggle('text-brand-500', isActive);
    icon.classList.toggle('text-gray-400', !isActive);
    icon.classList.remove('ph-arrow-up', 'ph-arrow-down');
    icon.classList.add(isActive && sortState.dir === 'desc' ? 'ph-arrow-down' : 'ph-arrow-up');
  });
}

function toggleFilterMenu(e) {
  e.stopPropagation();
  const menu = document.getElementById('filterMenu');
  const caret = document.getElementById('filterCaret');
  const isHidden = menu.classList.toggle('hidden');
  if (caret) caret.classList.toggle('rotate-180', !isHidden);
}

function closeFilterMenu() {
  const menu = document.getElementById('filterMenu');
  const caret = document.getElementById('filterCaret');
  if (menu) menu.classList.add('hidden');
  if (caret) caret.classList.remove('rotate-180');
}

document.addEventListener('click', (e) => {
  const menu = document.getElementById('filterMenu');
  const btn = document.getElementById('filterBtn');
  if (!menu || !btn) return;
  if (!menu.classList.contains('hidden') && !btn.contains(e.target) && !menu.contains(e.target)) {
    closeFilterMenu();
  }
});

/* ── Render ── */
function renderGrid(filter = "") {
  const grid = document.getElementById("labGrid");
  const q = filter.toLowerCase();

  let filtered = courses.filter(c =>
    c.code.toLowerCase().includes(q) ||
    c.name.toLowerCase().includes(q)
  );

  filtered = filtered.filter(c =>
    viewFilter === 'pending' ? c.pendingReviews > 0 : c.pendingReviews === 0
  );

  if (sortState.key) {
    const { key, dir } = sortState;
    filtered = [...filtered].sort((a, b) => {
      const va = a[key];
      const vb = b[key];
      const cmp = typeof va === 'string' ? va.localeCompare(vb) : va - vb;
      return dir === 'asc' ? cmp : -cmp;
    });
  }

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full py-12 flex flex-col items-center justify-center text-gray-500 bg-layout-surface rounded-xl border border-layout-border border-dashed">
        <i class="ph-fill ph-magnifying-glass text-4xl mb-2 text-gray-300"></i>
        <p class="text-p1 font-semibold">No classes found</p>
      </div>`;
    return;
  }

  grid.innerHTML = filtered.map((c, i) => {
    const isComplete = c.progress === 100;
    const progressTextColor = isComplete ? 'text-emerald-500' : 'text-brand-800';
    return `
    <div class="bg-layout-surface rounded-xl border border-layout-border shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow cursor-pointer" onclick="openCourse('${c.code}')">
      
      <!-- Top Color Bar -->
      <div class="h-1.5 w-full bg-${c.color}"></div>
      
      <div class="p-5 flex-1 flex flex-col">
        <!-- Header -->
        <div class="flex justify-between items-start mb-3">
            <span class="bg-${c.lightColor} text-${c.color} text-xs font-bold px-2.5 py-1 rounded border border-${c.color} border-opacity-20">${c.code}</span>
            <button class="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-brand-500 hover:text-white transition-colors" onclick="event.stopPropagation(); openCourse('${c.code}')">
                <i class="ph ph-arrow-right text-sm"></i>
            </button>
        </div>
        
        <!-- Course Name -->
        <h3 class="text-h3 text-brand-800 mb-4">${c.name}</h3>
        
        <!-- Progress -->
        <div class="mb-5">
            <div class="flex justify-between items-end mb-1.5">
                <span class="text-p2 text-gray-400 font-semibold">Grading Progress</span>
                <span class="text-p2 font-bold ${progressTextColor}">${c.progress}%</span>
            </div>
            <div class="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div class="h-full bg-${c.color} rounded-full" style="width: ${c.progress}%"></div>
            </div>
        </div>
        
        <!-- Stats Grid -->
        <div class="grid grid-cols-2 gap-0 mb-5 border border-gray-100 rounded-lg overflow-hidden">
            <div class="p-3 border-r border-gray-100">
                <div class="text-xs text-gray-400 font-semibold flex items-center gap-1 mb-1">
                    <i class="ph-fill ph-folder"></i> Total Labs
                </div>
                <div class="text-h3 text-brand-800">${c.totalLabs}</div>
            </div>
            <div class="p-3">
                <div class="text-xs text-gray-400 font-semibold flex items-center gap-1 mb-1">
                    <i class="ph-fill ph-users"></i> Sections
                </div>
                <div class="text-h3 text-brand-800">${c.sections}</div>
            </div>
        </div>
        
        <!-- Pending Status Alert -->
        ${c.pendingReviews > 0 ? `
            <div class="bg-amber-50 rounded-lg p-3 flex justify-between items-center mb-4">
                <div class="flex items-center gap-2 text-amber-500 font-bold text-p1">
                    <div class="w-2 h-2 rounded-full bg-amber-500"></div>
                    ${c.pendingReviews} Pending Reviews
                </div>
                <span class="text-xs text-amber-500 font-bold tracking-wider uppercase">Action req</span>
            </div>
        ` : `
            <div class="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex justify-between items-center mb-4">
                <div class="flex items-center gap-2 text-emerald-500 font-bold text-p1">
                    <i class="ph-fill ph-check-circle"></i>
                    All caught up
                </div>
                <span class="text-xs text-emerald-500 font-bold tracking-wider">0 Pending</span>
            </div>
        `}
        
        <!-- Spacer -->
        <div class="flex-1"></div>
        
        <!-- Divider -->
        <div class="border-t border-gray-100 -mx-5"></div>
        
        <!-- Add New Lab Button -->
        <button class="w-full pt-3 flex items-center justify-center gap-2 text-gray-500 hover:text-brand-800 font-semibold transition-colors text-p1" onclick="event.stopPropagation(); addLab('${c.code}')">
            <i class="ph ph-plus-circle text-lg"></i> Add New Lab
        </button>
      </div>
    </div>
  `;
  }).join("");
}

/* ── Open Course (navigate to lab list page) ── */
function openCourse(code) {
  window.location.href = `TaLablist.html?subjectId=${encodeURIComponent(code)}`;
}

/* ── Add Lab (navigate to create lab page) ── */
function addLab(code) {
  const params = new URLSearchParams();
  if (code) params.set('subjectId', code);
  const query = params.toString();
  window.location.href = `Ta_CreateLab.html${query ? `?${query}` : ''}`;
}

async function fetchLabSubmissionStats(labID) {
  try {
    const data = await apiFetch(buildQueryUrl(API_ENDPOINTS.submissions, { labID }));
    if (!data?.success) return { total: 0, passed: 0, rejected: 0, pending: 0 };
    const stats = data.stats || {};
    return {
      total: stats.total ?? (data.submissions?.length || 0),
      passed: stats.passed ?? 0,
      rejected: stats.rejected ?? 0,
      pending: stats.pending ?? 0,
    };
  } catch (err) {
    console.warn('submissions fetch failed for', labID, err);
    return { total: 0, passed: 0, rejected: 0, pending: 0 };
  }
}

function buildCourseSummary(subjectId, labs, statsByLab, paletteIdx) {
  const totalLabs = labs.length;
  const sectionSet = new Set();
  labs.forEach(l => getLabSections(l).forEach(s => sectionSet.add(s)));
  const totals = labs.reduce((acc, l) => {
    const s = statsByLab[getLabId(l)] || { total: 0, passed: 0, rejected: 0, pending: 0 };
    acc.total    += s.total;
    acc.passed   += s.passed;
    acc.rejected += s.rejected;
    acc.pending  += s.pending;
    return acc;
  }, { total: 0, passed: 0, rejected: 0, pending: 0 });
  const completed = totals.passed + totals.rejected;
  const progress = totals.total ? Math.round((completed / totals.total) * 100) : 0;
  const palette = COURSE_PALETTE[paletteIdx % COURSE_PALETTE.length];
  return {
    code: subjectId,
    name: getCourseTitle(subjectId),
    progress,
    totalLabs,
    sections: sectionSet.size,
    pendingReviews: totals.pending,
    status: `${totals.pending} Pending`,
    color: palette.color,
    lightColor: palette.lightColor,
  };
}

function renderDashboardError(message) {
  const grid = document.getElementById('labGrid');
  if (!grid) return;
  grid.innerHTML = `
    <div class="col-span-full py-10 flex flex-col items-center justify-center text-center bg-layout-surface rounded-xl border border-layout-border shadow-sm">
      <div class="flex items-center gap-2 text-status-error text-p1 font-semibold mb-1">
        <i class="ph-fill ph-warning-circle"></i>
        <span>Failed to load classes</span>
      </div>
      <p class="text-p2 text-gray-400">${escapeHtml(message)}</p>
      <button onclick="loadDashboard()" class="mt-4 inline-flex items-center gap-2 rounded-lg border border-layout-border bg-layout-surface px-4 py-2 text-btn text-brand-800 hover:border-brand-500 hover:text-brand-500 transition-colors">
        <i class="ph ph-arrow-counter-clockwise text-sm"></i> Try again
      </button>
    </div>`;
}

async function loadDashboard() {
  if (!currentTaUser) currentTaUser = requireAuth('ta');
  if (!currentTaUser) return;
  populateNavbarUser(currentTaUser);
  try {
    const data = await apiFetch(API_ENDPOINTS.labs);
    if (!data?.success) throw new Error(data?.error || 'Unable to load labs');
    const labs = data.labs || [];
    const grouped = labs.reduce((map, lab) => {
      const sid = getSubjectId(lab);
      (map[sid] = map[sid] || []).push(lab);
      return map;
    }, {});
    const statsEntries = await Promise.all(labs.map(async (lab) => {
      const stats = await fetchLabSubmissionStats(getLabId(lab));
      return [getLabId(lab), stats];
    }));
    const statsByLab = Object.fromEntries(statsEntries);
    courses = Object.keys(grouped).map((sid, idx) => buildCourseSummary(sid, grouped[sid], statsByLab, idx));
    renderGrid(document.getElementById('searchInput')?.value || '');
  } catch (err) {
    console.error('TA dashboard load failed:', err);
    renderDashboardError(err.message || 'Unknown error');
  }
}

function _legacy_populateNavbarUser_unused(user) {
  if (!user) return;
  const initials = getUserInitials(user);
  document.querySelectorAll('[data-user-name]').forEach(el => { el.textContent = user.name || user.email || 'TA'; });
  document.querySelectorAll('[data-user-role]').forEach(el => { el.textContent = user.roleLabel || 'Teaching Assistant'; });
  document.querySelectorAll('[data-user-initials]').forEach(el => { el.textContent = initials; });
}

/* ── Search ── */
document.getElementById('searchInput')?.addEventListener('input', e => renderGrid(e.target.value));

/* ── Init ── */
updateDashboardFilterButtons();
loadDashboard();