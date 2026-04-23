/* ── Mock: Course catalogue ── */
const COURSES = {
    "CS 232": {
        code: "CS 232",
        name: "Computer Architecture",
        labs: [
            { id: 201, name: "Lab 01 - CPU Registers", section: "650001", total: 5, submitted: 5, deadline: "10 Apr 2026" },
            { id: 202, name: "Lab 02 - Pipelining", section: "650001", total: 5, submitted: 5, deadline: "17 Apr 2026" },
            { id: 203, name: "Lab 03 - Cache Memory", section: "650002", total: 5, submitted: 5, deadline: "24 Apr 2026" }
        ]
    },
    "CS 251": {
        code: "CS 251",
        name: "Data Structures",
        labs: [
            { id: 301, name: "Lab 01 - Linked List", section: "660001", total: 5, submitted: 5, deadline: "12 Apr 2026" },
            { id: 302, name: "Lab 02 - Binary Tree", section: "660001", total: 5, submitted: 5, deadline: "19 Apr 2026" }
        ]
    },
    "CS 271": {
        code: "CS 271",
        name: "Operating Systems",
        labs: [
            { id: 401, name: "Lab 01 - Process Scheduling", section: "670001", total: 5, submitted: 5, deadline: "05 Apr 2026" },
            { id: 402, name: "Lab 02 - Threads & Mutex", section: "670002", total: 5, submitted: 5, deadline: "12 Apr 2026" }
        ]
    }
};

/* ── Read ?course= from URL and pick course (default CS 232) ── */
function getCurrentCourse() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('course');
    return COURSES[code] || COURSES["CS 232"];
}

const currentCourse = getCurrentCourse();
let labs = currentCourse.labs;

function renderLabs(data = labs) {
    const list = document.getElementById('labList');
    const count = document.getElementById('count-num');
    const header = document.getElementById('course-header');
    if(!list) return;

    count.innerText = data.length;
    list.innerHTML = '';

    data.forEach(lab => {
        const pending = lab.total - lab.submitted;
        const card = document.createElement('div');
        card.className = 'bg-layout-surface border border-layout-border rounded-xl px-6 py-5 grid grid-cols-[44px_1fr_80px_100px_auto_40px] items-center gap-6 hover:border-brand-500 hover:shadow-md transition-all cursor-pointer';
        card.onclick = () => openLab(lab.id);

        card.innerHTML = `
            <div class="w-11 h-11 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <i class="ph ph-file-text text-xl text-gray-400"></i>
            </div>
            <div>
                <h4 class="text-h4 font-bold text-brand-800 mb-1">${lab.name}</h4>
                <span class="inline-flex items-center gap-1.5 text-p2 font-bold text-gray-400 bg-gray-100 px-2.5 py-1 rounded-md">
                    <i class="ph ph-users-three text-xs"></i> Section ${lab.section}
                </span>
            </div>
            <div class="text-center">
                <p class="text-p2 font-bold text-gray-300 uppercase tracking-wider mb-1">Pending</p>
                <p class="text-2xl font-bold text-status-warning">${pending}</p>
            </div>
            <div class="text-center">
                <p class="text-p2 font-bold text-gray-300 uppercase tracking-wider mb-1">Submitted</p>
                <p class="text-2xl font-bold text-brand-800">${lab.submitted}<span class="text-base text-gray-300">/${lab.total}</span></p>
            </div>
            <button class="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-layout-border bg-layout-surface text-p1 font-bold hover:border-brand-500 hover:text-brand-500 transition-colors shadow-sm" onclick="event.stopPropagation(); downloadLabSubmissions(${lab.id})">
                <i class="ph ph-download-simple text-sm"></i> Download All
            </button>
            <div class="relative">
                <button class="w-9 h-9 flex items-center justify-center rounded-lg text-gray-300 hover:text-brand-800 hover:bg-gray-100 transition-colors" onclick="event.stopPropagation(); toggleMenu(event, ${lab.id})">
                    <i class="ph-fill ph-dots-three-outline-vertical text-lg"></i>
                </button>
                <div id="menu-${lab.id}" class="absolute right-0 top-full mt-1 bg-layout-surface border border-layout-border rounded-xl shadow-xl z-50 min-w-[160px] overflow-hidden hidden">
                    <button class="w-full text-left px-4 py-3 text-p1 font-semibold text-status-error flex items-center gap-2 hover:bg-red-50 transition-colors" onclick="event.stopPropagation(); removeLab(${lab.id})">
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
    if(confirm('Are you sure you want to delete this lab?')) {
        labs = labs.filter(l => l.id !== id);
        renderLabs();
    }
}

function searchLabs() {
    const q = document.getElementById('labSearch').value.toLowerCase();
    const filtered = labs.filter(l => l.name.toLowerCase().includes(q) || l.section.includes(q));
    renderLabs(filtered);
}

function downloadLabSubmissions(id) {
    const lab = labs.find(l => l.id === id);
    if (!lab) return;

    const rows = [
        ['Lab', 'Section', 'Submitted', 'Total', 'Pending', 'Deadline'],
        [lab.name, lab.section, lab.submitted, lab.total, lab.total - lab.submitted, lab.deadline]
    ];

    const csv = rows
        .map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(','))
        .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${lab.name.replace(/[^a-z0-9]+/gi, '_').toLowerCase()}_submissions.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// คลิกที่อื่นเพื่อปิดเมนู
window.onclick = () => document.querySelectorAll('[id^="menu-"]').forEach(m => m.classList.add('hidden'));

/* ── Navigate to Lab Report (TaViewSubmission.html) ── */
function openLab(id) {
    const params = new URLSearchParams();
    params.set('course', currentCourse.code);
    params.set('lab', id);
    window.location.href = `TaViewSubmission.html?${params.toString()}`;
}

/* ── Update header with current course info ── */
function updateCourseHeader() {
    const codeEl = document.getElementById('courseCode');
    const nameEl = document.getElementById('courseName');
    if (codeEl) codeEl.innerText = currentCourse.code;
    if (nameEl) nameEl.innerText = currentCourse.name;
    document.title = `ValidMate - ${currentCourse.code} Lab List`;
}

// โหลดครั้งแรก
document.addEventListener('DOMContentLoaded', () => {
    updateCourseHeader();
    renderLabs();
});