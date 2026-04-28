// ฟังก์ชันสลับสถานะหน้าจอ
function updateResultView(state) {
    // ซ่อนทุกหน้าก่อน
    document.querySelectorAll('.status-view').forEach(view => {
        view.classList.add('hidden');
    });

    // แสดงหน้าที่ต้องการ (processing, passed, failed)
    const target = document.getElementById('state-' + state);
    if (target) {
        target.classList.remove('hidden');
    }
}

function getLabIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('lab') || params.get('labID') || '';
}

function statusToView(status) {
    const raw = String(status || '').toUpperCase();
    if (raw === 'PASSED') return 'passed';
    if (raw === 'REJECTED' || raw === 'FAILED') return 'failed';
    return 'processing';
}

function applySubmissionToView(submission, lab) {
    const view = statusToView(submission?.status);
    updateResultView(view);

    // อัพเดท breadcrumb + header จากข้อมูล lab จริง — ไม่ใช้ค่า hardcode อีกต่อไป
    if (lab) {
        const labName = getLabName(lab);
        const subjectId = getSubjectId(lab);
        const classID = new URLSearchParams(window.location.search).get('classID') || subjectId;

        // ชื่อ lab ในหน้า
        document.querySelectorAll('[data-lab-name]').forEach(el => { el.textContent = labName; });
        document.querySelectorAll('[data-lab-subject]').forEach(el => { el.textContent = subjectId; });

        // breadcrumb — ชื่อวิชา + ลิงก์กลับ
        const courseNameEl = document.getElementById('breadcrumbCourseName');
        const courseBtn = document.getElementById('breadcrumbCourseBtn');
        if (courseNameEl) courseNameEl.textContent = subjectId || '—';
        if (courseBtn) courseBtn.onclick = () => window.location.href = `student_Lablist.html?subjectId=${encodeURIComponent(classID)}`;

        // breadcrumb — ชื่อ lab + ลิงก์กลับ submission page
        const labNameEl = document.getElementById('breadcrumbLabName');
        const labBtn = document.getElementById('breadcrumbLabBtn');
        if (labNameEl) labNameEl.textContent = labName || '—';
        if (labBtn) labBtn.onclick = () => window.location.href = `submissionPage.html?labID=${encodeURIComponent(activeLabID)}&classID=${encodeURIComponent(classID)}`;

        // header card title
        const titleEl = document.getElementById('resultLabTitle');
        if (titleEl) titleEl.textContent = labName;

        document.title = `ValidMate – ${labName} Result`;
    }

    if (submission) {
        document.querySelectorAll('[data-submission-score]').forEach(el => {
            el.textContent = submission.totalScore != null ? `${submission.totalScore}%` : '—';
        });
        document.querySelectorAll('[data-submission-checked]').forEach(el => {
            el.textContent = submission.checkedAt ? formatDateLabel(submission.checkedAt) : '—';
        });
    }
}

async function fetchSubmission() {
    if (!activeUser?.email || !activeLabID) return null;
    try {
        const data = await apiFetch(buildQueryUrl(API_ENDPOINTS.result, { email: activeUser.email, labID: activeLabID }));
        return data?.submission || null;
    } catch (err) {
        if (err.status === 404) return null;
        throw err;
    }
}

async function fetchLabMeta(labID) {
    try {
        const data = await apiFetch(API_ENDPOINTS.labs);
        if (!data?.success) return null;
        return (data.labs || []).find(l => getLabId(l) === labID) || null;
    } catch (err) {
        console.warn('Could not load lab meta', err);
        return null;
    }
}

async function pollOnce(lab) {
    pollAttempts += 1;
    let submission = null;
    try {
        submission = await fetchSubmission();
    } catch (err) {
        console.error('result fetch error', err);
    }
    applySubmissionToView(submission, lab);
    const view = statusToView(submission?.status);
    if (view !== 'processing') {
        if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
        return;
    }
    if (pollAttempts >= MAX_POLL_ATTEMPTS) {
        if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    }
}

const POLL_INTERVAL_MS = 4000;
const MAX_POLL_ATTEMPTS = 90; // ~6 minutes
let pollAttempts = 0;
let pollTimer = null;
let activeUser = null;
let activeLabID = '';

window.addEventListener('DOMContentLoaded', async () => {
    activeUser = await requireAuth('student');
    if (!activeUser) return;
    populateNavbarUser(activeUser);
    activeLabID = getLabIdFromUrl();
    updateResultView('processing');
    if (!activeLabID) {
        console.warn('Missing lab id in URL');
        return;
    }
    const lab = await fetchLabMeta(activeLabID);
    await pollOnce(lab);
    pollTimer = setInterval(() => pollOnce(lab), POLL_INTERVAL_MS);
});