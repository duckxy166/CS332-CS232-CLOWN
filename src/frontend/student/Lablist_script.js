// ข้อมูลจำลอง - ในอนาคตก้อนนี้จะถูกดึงมาจาก Database ผ่าน Backend API
let labs = [
    { id: 5, title: "Lab 05 - CPU Pipelining", desc: "Upload AWS EC2 instance screenshots", status: "NOT_SUBMITTED", score: null, meta: "DUE TOMORROW, 11:59 PM", metaIcon: "ph-calendar-blank" },
    { id: 4, title: "Lab 04 - Cache Memory Design", desc: "S3 bucket configuration and deployment", status: "PENDING", score: null, meta: "Submitted Oct 12, 2:30 PM", metaIcon: "ph-clock" },
    { id: 3, title: "Lab 03 - ALU Logic Verification", desc: "Lambda function trigger validation", status: "REJECTED", score: null, meta: "Failed 1 Mandatory Rule", metaIcon: null },
    { id: 2, title: "Lab 02 - Instruction Set Architecture", desc: "IAM Role policy creation", status: "PASSED", score: 100, meta: "Graded Oct 05, 10:15 AM", metaIcon: "ph-check-circle" },
    { id: 1, title: "Lab 01 - Intro to Verilog", desc: "Basic cloud environment setup", status: "PASSED", score: 100, meta: "Graded Sep 28, 09:00 AM", metaIcon: "ph-check-circle" }
];

let currentFilter = 'ALL';
let searchTerm = '';

const COURSE_META = {
    'CS 232': { name: 'Computer Architecture', section: '650001' },
    'CS 251': { name: 'Data Structures', section: '660001' },
    'CS 271': { name: 'Operating Systems', section: '670001' },
};

function getCurrentSubjectId() {
    return new URLSearchParams(window.location.search).get('subjectId') || 'CS 232';
}

function updateCourseHeader() {
    const subjectId = getCurrentSubjectId();
    const meta = COURSE_META[subjectId] || { name: subjectId, section: '650001' };
    const completedCount = labs.filter(lab => lab.status === 'PASSED' || lab.status === 'REJECTED').length;
    const totalCount = 6;
    const progressPct = totalCount ? Math.round((completedCount / totalCount) * 100) : 0;

    const courseCode = document.getElementById('courseCode');
    const breadcrumbCourse = document.getElementById('breadcrumbCourse');
    const courseName = document.getElementById('courseName');
    const courseSection = document.getElementById('courseSection');
    const progressText = document.getElementById('progressText');
    const progressFill = document.getElementById('progressFill');
    const labCount = document.getElementById('labCount');

    if (courseCode) courseCode.textContent = subjectId;
    if (breadcrumbCourse) breadcrumbCourse.textContent = subjectId;
    if (courseName) courseName.textContent = meta.name;
    if (courseSection) courseSection.textContent = meta.section;
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
            matchesFilter = (lab.status === 'PASSED' || lab.status === 'REJECTED');
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
        const isRejected = lab.status === 'REJECTED';
        const metaColor = isRejected ? 'text-status-error font-bold' : 'text-gray-400';
        const metaIcon = lab.metaIcon ? `<i class="ph ${lab.metaIcon} text-sm"></i>` : '';
        return `
        <div class="bg-layout-surface p-5 rounded-xl border ${isRejected ? 'border-status-error border-l-4' : 'border-layout-border'} shadow-sm flex flex-col md:flex-row justify-between items-center gap-4 transition-all hover:shadow-md">
            <div class="flex items-center gap-4 w-full">
                <div class="w-12 h-12 rounded-xl flex items-center justify-center text-xl
                    ${lab.status === 'PASSED' ? 'bg-status-successBg text-status-success' :
                      lab.status === 'REJECTED' ? 'bg-status-errorBg text-status-error' :
                      lab.status === 'PENDING' ? 'bg-status-warningBg text-status-warning' : 'bg-layout-bg text-gray-400'}">
                    <i class="ph-fill ph-file-text"></i>
                </div>
                <div>
                    <h3 class="text-h4 font-bold text-brand-800">${lab.title}</h3>
                    <p class="text-p2 text-gray-400">${lab.desc}</p>
                    ${lab.meta ? `<p class="text-p2 ${metaColor} mt-1 flex items-center gap-1 uppercase tracking-wide">${metaIcon} ${lab.meta}</p>` : ''}
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
    switch (lab.status) {
        case 'PASSED':
            return `
                <div class="mr-2 whitespace-nowrap">
                    <span class="text-p1 text-gray-500">Score: </span>
                    <span class="text-status-success font-bold text-p1">${lab.score}</span>
                </div>
                <span class="text-p2 font-bold text-status-success bg-status-successBg px-3 py-1 rounded-lg uppercase tracking-wider whitespace-nowrap">Passed</span>
                <button type="button" onclick="window.location.href='submissionResult.html?state=passed'" class="px-6 py-2 border border-layout-border rounded-lg text-btn text-brand-800 hover:border-brand-500 hover:text-brand-500 transition-colors whitespace-nowrap">View Results</button>
            `;
        case 'REJECTED':
            return `
                <span class="flex items-center gap-1 text-p2 font-bold text-status-error bg-status-errorBg px-3 py-1 rounded-lg uppercase tracking-wider whitespace-nowrap">
                    <i class="ph-fill ph-x-circle text-sm"></i> Rejected
                </span>
                <button type="button" onclick="window.location.href='submissionResult.html?state=rejected'" class="px-6 py-2 border border-red-200 rounded-lg text-btn text-status-error hover:bg-red-50 transition-colors whitespace-nowrap">View Feedback</button>
            `;
        case 'PENDING':
            return `
                <span class="text-p2 font-bold text-status-warning bg-status-warningBg px-3 py-1 rounded-lg uppercase tracking-wider flex items-center gap-1 whitespace-nowrap">
                    <i class="ph ph-hourglass text-sm"></i> Pending
                </span>
                <button type="button" disabled class="px-6 py-2 bg-layout-bg rounded-lg text-btn text-gray-400 cursor-not-allowed whitespace-nowrap">Processing...</button>
            `;
        default:
            return `
                <span class="text-p2 font-bold text-gray-400 bg-layout-bg px-3 py-1 rounded-lg uppercase tracking-wider whitespace-nowrap">Not Submitted</span>
                <button type="button" onclick="window.location.href='submissionPage.html?lab=${lab.id}'" class="px-8 py-2.5 bg-brand-500 text-white rounded-lg text-btn hover:bg-indigo-600 transition-all shadow-sm whitespace-nowrap">Submit Lab</button>
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

/**
 * ระบบจำลองการตรวจ Lab (Simulation)
 * ค้นหาตัวที่เป็น PENDING และเปลี่ยนสถานะหลังจาก 5 วินาที
 */
function simulateBackendCheck() {
    setInterval(() => {
        let hasChange = false;
        labs = labs.map(lab => {
            if (lab.status === 'PENDING') {
                hasChange = true;
                const isPassed = Math.random() > 0.2; // โอกาสผ่าน 80%
                return {
                    ...lab,
                    status: isPassed ? 'PASSED' : 'REJECTED',
                    score: isPassed ? Math.floor(Math.random() * (100 - 80 + 1)) + 80 : null
                };
            }
            return lab;
        });

        if (hasChange) {
            renderLabs();
        }
    }, 5000); 
}

// Event Listeners
document.getElementById('searchInput')?.addEventListener('input', (e) => {
    searchTerm = e.target.value;
    renderLabs();
});

// เริ่มต้นโปรแกรม
updateCourseHeader();
renderLabs();
simulateBackendCheck();