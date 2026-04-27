// Real backend-driven lab list. Fetches /labs (filtered by subjectId) and overlays
// per-lab submission status via /result?email&labID for the logged-in student.
let labs = [];
let currentFilter = 'ALL';
let searchTerm = '';
let pollTimer = null;
let currentUser = null;

function getCurrentSubjectId() {
    return new URLSearchParams(window.location.search).get('subjectId') || '';
}

function formatDeadlineMeta(iso) {
    if (!iso) return null;
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return null;
    const diffMs = date - new Date();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    const time = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    if (diffDays < 0) return `OVERDUE · ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()}`;
    if (diffDays === 0) return `DUE TODAY, ${time}`;
    if (diffDays === 1) return `DUE TOMORROW, ${time}`;
    if (diffDays <= 7) return `DUE IN ${diffDays} DAYS, ${time}`;
    return `DUE ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()}, ${time}`;
}

function buildLab(lab, submission) {
    const labID = getLabId(lab);
    const labName = getLabName(lab);
    const description = lab?.description || '';
    const status = normalizeStudentStatus(submission);
    let meta = null;
    let metaIcon = null;
    if (submission?.checkedAt && (status === 'PASSED' || status === 'FAILED')) {
        meta = `Graded ${formatDateLabel(submission.checkedAt)}`;
        metaIcon = status === 'PASSED' ? 'ph-check-circle' : 'ph-warning-octagon';
    } else if (submission?.submittedAt && status === 'PENDING') {
        meta = `Submitted ${formatDateLabel(submission.submittedAt)}`;
        metaIcon = 'ph-clock';
    } else if (lab?.dueDate) {
        meta = formatDeadlineMeta(lab.dueDate);
        metaIcon = 'ph-calendar-blank';
    }
    return {
        id: labID,
        labRaw: lab,
        title: labName,
        desc: description,
        status,
        score: submission?.totalScore ?? null,
        meta,
        metaIcon,
    };
}

function updateCourseHeader() {
    const subjectId = getCurrentSubjectId();
    const sectionLabel = (() => {
        const sections = new Set();
        labs.forEach(l => getLabSections(l.labRaw).forEach(s => sections.add(s)));
        return sections.size ? Array.from(sections).join(', ') : '—';
    })();
    const completedCount = labs.filter(l => l.status === 'PASSED' || l.status === 'FAILED').length;
    const totalCount = labs.length;
    const progressPct = totalCount ? Math.round((completedCount / totalCount) * 100) : 0;

    const courseCode = document.getElementById('courseCode');
    const breadcrumbCourse = document.getElementById('breadcrumbCourse');
    const courseName = document.getElementById('courseName');
    const courseSection = document.getElementById('courseSection');
    const progressText = document.getElementById('progressText');
    const progressFill = document.getElementById('progressFill');
    const labCount = document.getElementById('labCount');

    if (courseCode) courseCode.textContent = subjectId || 'All';
    if (breadcrumbCourse) breadcrumbCourse.textContent = subjectId || 'All Labs';
    if (courseName) courseName.textContent = getCourseTitle(subjectId);
    if (courseSection) courseSection.textContent = sectionLabel;
    if (progressText) progressText.textContent = `${completedCount}/${totalCount}`;
    if (progressFill) progressFill.style.width = `${progressPct}%`;
    if (labCount) labCount.textContent = String(totalCount);
}

/**
 * ฟังก์ชันหลักในการวาดรายการ Lab บนหน้าจอ
 */
function renderLabs() {
    const container = document.getElementById('lab-list');

    if (!container) return;

    // กรองข้อมูลตาม Filter และ Search
    const filteredLabs = labs.filter(lab => {
        const matchesSearch = lab.title.toLowerCase().includes(searchTerm.toLowerCase());
        let matchesFilter = true;
        if (currentFilter === 'PENDING') {
            matchesFilter = (lab.status === 'PENDING');
        } else if (currentFilter === 'COMPLETED') {
            matchesFilter = (lab.status === 'PASSED' || lab.status === 'FAILED');
        }
        return matchesSearch && matchesFilter;
    });

    if (filteredLabs.length === 0) {
        container.innerHTML = `
            <div class="rounded-xl border border-layout-border bg-layout-surface px-6 py-12 text-center text-gray-400 shadow-sm">
                <i class="ph-fill ph-magnifying-glass text-4xl mb-2 text-gray-300"></i>
                <p class="text-p1 font-semibold">No labs found</p>
            </div>`;
        return;
    }

    container.innerHTML = filteredLabs.map(lab => {
        const isFailed = lab.status === 'FAILED';
        const metaColor = isFailed ? 'text-status-error font-bold' : 'text-gray-400';
        const metaIcon = lab.metaIcon ? `<i class="ph ${lab.metaIcon} text-sm"></i>` : '';
        return `
        <div class="bg-layout-surface p-5 rounded-xl border ${isFailed ? 'border-status-error border-l-4' : 'border-layout-border'} shadow-sm flex flex-col md:flex-row justify-between items-center gap-4 transition-all hover:shadow-md">
            <div class="flex items-center gap-4 w-full">
                <div class="w-12 h-12 rounded-xl flex items-center justify-center text-xl
                    ${lab.status === 'PASSED' ? 'bg-status-successBg text-status-success' :
                      lab.status === 'FAILED' ? 'bg-status-errorBg text-status-error' :
                      lab.status === 'PENDING' ? 'bg-status-warningBg text-status-warning' : 'bg-layout-bg text-gray-400'}">
                    <i class="ph-fill ph-file-text"></i>
                </div>
                <div>
                    <h3 class="text-h4 font-bold text-brand-800">${escapeHtml(lab.title)}</h3>
                    <p class="text-p2 text-gray-400">${escapeHtml(lab.desc)}</p>
                    ${lab.meta ? `<p class="text-p2 ${metaColor} mt-1 flex items-center gap-1 uppercase tracking-wide">${metaIcon} ${escapeHtml(lab.meta)}</p>` : ''}
                </div>
            </div>
            <div class="flex items-center gap-4 w-full md:w-auto justify-end">
                ${renderStatusUI(lab)}
            </div>
        </div>
    `;}).join('');
}

/**
 * จัดการแสดงผลปุ่มและสถานะตามเงื่อนไข (แก้ไขเป็น Pending ตามรูปภาพ)
 */
function renderStatusUI(lab) {
    const labParam = encodeURIComponent(lab.id || '');
    const classParam = encodeURIComponent(lab.labRaw?.classID || getCurrentSubjectId() || '');
    switch (lab.status) {
        case 'PASSED':
            return `
                <div class="mr-2 whitespace-nowrap">
                    <span class="text-p1 text-gray-500">Score: </span>
                    <span class="text-status-success font-bold text-p1">${lab.score ?? '-'}</span>
                </div>
                <span class="text-p2 font-bold text-status-success bg-status-successBg px-3 py-1 rounded-lg uppercase tracking-wider whitespace-nowrap">Passed</span>
                <button type="button" onclick="window.location.href='submissionResult.html?labID=${labParam}&classID=${classParam}&state=passed'" class="px-6 py-2 border border-layout-border rounded-lg text-btn text-brand-800 hover:border-brand-500 hover:text-brand-500 transition-colors whitespace-nowrap">View Results</button>
            `;
        case 'FAILED':
            return `
                <span class="flex items-center gap-1 text-p2 font-bold text-status-error bg-status-errorBg px-3 py-1 rounded-lg uppercase tracking-wider whitespace-nowrap">
                    <i class="ph-fill ph-warning-octagon text-sm"></i> Failed
                </span>
                <button type="button" onclick="window.location.href='submissionResult.html?labID=${labParam}&classID=${classParam}&state=failed'" class="px-6 py-2 border border-red-200 rounded-lg text-btn text-status-error hover:bg-red-50 transition-colors whitespace-nowrap">View Details</button>
                <button type="button" onclick="window.location.href='submissionPage.html?labID=${labParam}&classID=${classParam}'" class="px-4 py-2 border border-layout-border rounded-lg text-btn text-brand-800 hover:border-brand-500 hover:text-brand-500 transition-colors whitespace-nowrap">Resubmit</button>
            `;
        case 'PENDING':
            return `
                <span class="text-p2 font-bold text-status-warning bg-status-warningBg px-3 py-1 rounded-lg uppercase tracking-wider flex items-center gap-1 whitespace-nowrap">
                    <i class="ph ph-hourglass text-sm"></i> Pending
                </span>
                <button type="button" onclick="window.location.href='submissionResult.html?labID=${labParam}&classID=${classParam}&state=processing'" class="px-6 py-2 border border-layout-border rounded-lg text-btn text-brand-800 hover:border-brand-500 hover:text-brand-500 transition-colors whitespace-nowrap">View Status</button>
            `;
        default:
            return `
                <span class="text-p2 font-bold text-gray-400 bg-layout-bg px-3 py-1 rounded-lg uppercase tracking-wider whitespace-nowrap">Not Submitted</span>
                <button type="button" onclick="window.location.href='submissionPage.html?labID=${labParam}&classID=${classParam}'" class="px-8 py-2.5 bg-brand-500 text-white rounded-lg text-btn hover:bg-indigo-600 transition-all shadow-sm whitespace-nowrap">Submit Lab</button>
            `;
    }
}

/**
 * ระบบ Filter
 */
function filterLabs(type) {
    currentFilter = type;
    const buttons = document.querySelectorAll('.filter-btn');
    buttons.forEach(btn => {
        const isTarget = (type === 'ALL' && btn.innerText.includes('All')) || 
                         btn.innerText.toUpperCase().includes(type);
        
        if (isTarget) {
            btn.classList.add('active', 'bg-brand-900', 'text-white');
            btn.classList.remove('text-gray-500', 'hover:bg-gray-50');
        } else {
            btn.classList.remove('active', 'bg-brand-900', 'text-white');
            btn.classList.add('text-gray-500', 'hover:bg-gray-50');
        }
    });
    renderLabs();
}

async function fetchSubmissionForLab(email, labID) {
    if (!email || !labID) return null;
    try {
        const data = await apiFetch(buildQueryUrl(API_ENDPOINTS.result, { email, labID }));
        return data?.submission || null;
    } catch (err) {
        if (err.status === 404) return null;
        console.warn('result fetch failed for', labID, err);
        return null;
    }
}

function renderError(message) {
    const container = document.getElementById('lab-list');
    if (!container) return;
    container.innerHTML = `
        <div class="rounded-xl border border-layout-border bg-layout-surface px-6 py-10 text-center shadow-sm">
            <div class="flex items-center justify-center gap-2 text-status-error text-p1 font-semibold mb-2">
                <i class="ph-fill ph-warning-circle text-base"></i>
                <span>Failed to load labs</span>
            </div>
            <div class="text-p2 text-gray-400">${escapeHtml(message)}</div>
            <button onclick="loadLabs()" class="mt-4 inline-flex items-center gap-2 rounded-lg border border-layout-border bg-layout-surface px-4 py-2 text-btn text-brand-800 hover:border-brand-500 hover:text-brand-500 transition-colors">
                <i class="ph ph-arrow-counter-clockwise text-sm"></i>
                Try again
            </button>
        </div>`;
}

async function loadLabs() {
    if (!currentUser) currentUser = requireAuth('student');
    if (!currentUser) return;
    try {
        const data = await apiFetch(API_ENDPOINTS.labs);
        if (!data?.success) throw new Error(data?.error || 'Unable to load labs');
        const subjectId = getCurrentSubjectId();
        const allLabs = data.labs || [];
        const filteredByCourse = subjectId ? allLabs.filter(l => getSubjectId(l) === subjectId) : allLabs;
        const enriched = await Promise.all(filteredByCourse.map(async (lab) => {
            const submission = await fetchSubmissionForLab(currentUser.email, getLabId(lab));
            return buildLab(lab, submission);
        }));
        labs = enriched;
        updateCourseHeader();
        renderLabs();
    } catch (err) {
        console.error('Lab list load failed:', err);
        renderError(err.message || 'Unknown error');
    }
}

function startPendingPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(async () => {
        if (!currentUser) return;
        const pending = labs.filter(l => l.status === 'PENDING');
        if (pending.length === 0) return;
        const updates = await Promise.all(pending.map(async (lab) => {
            const submission = await fetchSubmissionForLab(currentUser.email, lab.id);
            return [lab.id, submission];
        }));
        let changed = false;
        updates.forEach(([labID, submission]) => {
            const idx = labs.findIndex(l => l.id === labID);
            if (idx === -1) return;
            const next = buildLab(labs[idx].labRaw, submission);
            if (next.status !== labs[idx].status) changed = true;
            labs[idx] = next;
        });
        if (changed) {
            updateCourseHeader();
            renderLabs();
        }
    }, 8000);
}

document.getElementById('searchInput')?.addEventListener('input', (e) => {
    searchTerm = e.target.value;
    renderLabs();
});

document.addEventListener('DOMContentLoaded', () => {
    loadLabs().then(startPendingPolling);
});