/* TA lab list — real backend driven (subjectId from URL filters /labs) */
let labs = [];
let currentSubjectId = '';
let currentTaUser = null;

function getCurrentSubjectId() {
    const params = new URLSearchParams(window.location.search);
    return params.get('subjectId') || params.get('course') || '';
}

function normaliseLab(lab, stats) {
    const labID = getLabId(lab);
    const sections = getLabSections(lab);
    return {
        id: labID,
        labRaw: lab,
        name: getLabName(lab),
        section: sections.join(', ') || '—',
        total: stats.total ?? 0,
        submitted: stats.total ?? 0,
        passed: stats.passed ?? 0,
        rejected: stats.rejected ?? 0,
        pending: stats.pending ?? 0,
        deadline: lab.deadline ? formatDateLabel(lab.deadline) : '—',
    };
}

async function fetchStats(labID) {
    if (!labID) return { total: 0, passed: 0, rejected: 0, pending: 0 };
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

function renderLabs(data = labs) {
    const list = document.getElementById('labList');
    const count = document.getElementById('count-num');
    if(!list) return;

    if (count) count.innerText = data.length;
    list.innerHTML = '';

    if (data.length === 0) {
        list.innerHTML = `
            <div class="py-12 flex flex-col items-center justify-center text-gray-400 bg-layout-surface rounded-xl border border-layout-border border-dashed">
                <i class="ph-fill ph-magnifying-glass text-4xl mb-2 text-gray-300"></i>
                <p class="text-p1 font-semibold">No labs found</p>
            </div>`;
        return;
    }

    data.forEach(lab => {
        const labIdSafe = encodeURIComponent(lab.id || '');
        const card = document.createElement('div');
        card.className = 'bg-layout-surface border border-layout-border rounded-xl px-6 py-5 grid grid-cols-[44px_1fr_80px_100px_auto_40px] items-center gap-6 hover:border-brand-500 hover:shadow-md transition-all cursor-pointer';
        card.onclick = () => openLab(lab.id);

        card.innerHTML = `
            <div class="w-11 h-11 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <i class="ph ph-file-text text-xl text-gray-400"></i>
            </div>
            <div>
                <h4 class="text-h4 font-bold text-brand-800 mb-1">${escapeHtml(lab.name)}</h4>
                <span class="inline-flex items-center gap-1.5 text-p2 font-bold text-gray-400 bg-gray-100 px-2.5 py-1 rounded-md">
                    <i class="ph ph-users-three text-xs"></i> Section ${escapeHtml(lab.section)}
                </span>
            </div>
            <div class="text-center">
                <p class="text-p2 font-bold text-gray-300 uppercase tracking-wider mb-1">Pending</p>
                <p class="text-2xl font-bold text-status-warning">${lab.pending}</p>
            </div>
            <div class="text-center">
                <p class="text-p2 font-bold text-gray-300 uppercase tracking-wider mb-1">Submitted</p>
                <p class="text-2xl font-bold text-brand-800">${lab.submitted}<span class="text-base text-gray-300">/${lab.total}</span></p>
            </div>
            <button class="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-layout-border bg-layout-surface text-p1 font-bold hover:border-brand-500 hover:text-brand-500 transition-colors shadow-sm" onclick="event.stopPropagation(); downloadLabSubmissions('${labIdSafe}')">
                <i class="ph ph-download-simple text-sm"></i> Download All
            </button>
            <div class="relative">
                <button class="w-9 h-9 flex items-center justify-center rounded-lg text-gray-300 hover:text-brand-800 hover:bg-gray-100 transition-colors" onclick="event.stopPropagation(); toggleMenu(event, '${labIdSafe}')">
                    <i class="ph-fill ph-dots-three-outline-vertical text-lg"></i>
                </button>
                <div id="menu-${labIdSafe}" class="absolute right-0 top-full mt-1 bg-layout-surface border border-layout-border rounded-xl shadow-xl z-50 min-w-[160px] overflow-hidden hidden">
                    <button class="w-full text-left px-4 py-3 text-p1 font-semibold text-status-error flex items-center gap-2 hover:bg-red-50 transition-colors" onclick="event.stopPropagation(); removeLab('${labIdSafe}')">
                        <i class="ph ph-trash text-sm"></i> Delete Lab
                    </button>
                </div>
            </div>
        `;
        list.appendChild(card);
    });
}

function toggleMenu(e, id) {
    e.stopPropagation();
    const menu = document.getElementById(`menu-${id}`);
    document.querySelectorAll('[id^="menu-"]').forEach(m => {
        if(m.id !== `menu-${id}`) m.classList.add('hidden');
    });
    menu.classList.toggle('hidden');
}

function removeLab(id) {
    alert('Lab deletion is not yet wired to the backend. Please remove labs via the AWS console or extend the lab-config Lambda.');
}

function searchLabs() {
    const q = (document.getElementById('labSearch')?.value || '').toLowerCase();
    const filtered = labs.filter(l => l.name.toLowerCase().includes(q) || (l.section || '').toLowerCase().includes(q));
    renderLabs(filtered);
}

function downloadLabSubmissions(id) {
    const lab = labs.find(l => l.id === id);
    if (!lab) return;
    const rows = [
        ['Lab', 'Section', 'Submitted', 'Total', 'Pending', 'Deadline'],
        [lab.name, lab.section, lab.submitted, lab.total, lab.pending, lab.deadline]
    ];
    const csv = rows.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${lab.name.replace(/[^a-z0-9]+/gi, '_').toLowerCase()}_summary.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

window.onclick = () => document.querySelectorAll('[id^="menu-"]').forEach(m => m.classList.add('hidden'));

/* ── Navigate to Lab Report (TaViewSubmission.html) ── */
function openLab(id) {
    if (!id) return;
    const params = new URLSearchParams();
    if (currentSubjectId) params.set('subjectId', currentSubjectId);
    params.set('lab', id);
    window.location.href = `TaViewSubmission.html?${params.toString()}`;
}

function updateCourseHeader() {
    const codeEl = document.getElementById('courseCode');
    const nameEl = document.getElementById('courseName');
    if (codeEl) codeEl.innerText = currentSubjectId || 'All Labs';
    if (nameEl) nameEl.innerText = getCourseTitle(currentSubjectId);
    document.title = `ValidMate - ${currentSubjectId || 'All'} Lab List`;
}

async function loadTaLabList() {
    if (!currentTaUser) currentTaUser = requireAuth('ta');
    if (!currentTaUser) return;
    populateNavbarUser(currentTaUser);
    currentSubjectId = getCurrentSubjectId();
    updateCourseHeader();
    try {
        const data = await apiFetch(API_ENDPOINTS.labs);
        if (!data?.success) throw new Error(data?.error || 'Unable to load labs');
        const all = data.labs || [];
        const filtered = currentSubjectId ? all.filter(l => getSubjectId(l) === currentSubjectId) : all;
        const enriched = await Promise.all(filtered.map(async (lab) => {
            const stats = await fetchStats(getLabId(lab));
            return normaliseLab(lab, stats);
        }));
        labs = enriched;
        renderLabs();
    } catch (err) {
        console.error('TA lab list load failed:', err);
        const list = document.getElementById('labList');
        if (list) {
            list.innerHTML = `
                <div class="py-12 flex flex-col items-center justify-center text-center bg-layout-surface rounded-xl border border-layout-border shadow-sm">
                    <div class="flex items-center gap-2 text-status-error text-p1 font-semibold mb-1">
                        <i class="ph-fill ph-warning-circle"></i>
                        <span>Failed to load labs</span>
                    </div>
                    <p class="text-p2 text-gray-400">${escapeHtml(err.message || 'Unknown error')}</p>
                    <button onclick="loadTaLabList()" class="mt-4 inline-flex items-center gap-2 rounded-lg border border-layout-border bg-layout-surface px-4 py-2 text-btn text-brand-800 hover:border-brand-500 hover:text-brand-500 transition-colors">
                        <i class="ph ph-arrow-counter-clockwise text-sm"></i> Try again
                    </button>
                </div>`;
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadTaLabList();
});