// ข้อมูลจำลอง - ในอนาคตก้อนนี้จะถูกดึงมาจาก Database ผ่าน Backend API
let labs = [
    { id: 5, title: "Lab 05 - CPU Pipelining", desc: "Upload AWS EC2 instance screenshots", status: "NOT_SUBMITTED", score: null },
    { id: 4, title: "Lab 04 - Cache Memory Design", desc: "S3 bucket configuration", status: "PENDING", score: null },
    { id: 3, title: "Lab 03 - ALU Logic Verification", desc: "Lambda function trigger validation", status: "REJECTED", score: null },
    { id: 2, title: "Lab 02 - Instruction Set Architecture", desc: "IAM Role policy creation", status: "PASSED", score: 100 },
    { id: 1, title: "Lab 01 - Intro to Verilog", desc: "Basic cloud environment setup", status: "PASSED", score: 95 }
];

let currentFilter = 'ALL';
let searchTerm = '';

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
            matchesFilter = (lab.status === 'PASSED');
        }
        return matchesSearch && matchesFilter;
    });

    if (filteredLabs.length === 0) {
        container.innerHTML = `<div class="text-center py-10 text-gray-400 font-medium">ไม่พบข้อมูลแล็บที่ค้นหา</div>`;
        return;
    }

    container.innerHTML = filteredLabs.map(lab => `
        <div class="bg-white p-5 rounded-2xl border ${lab.status === 'REJECTED' ? 'border-red-100 border-l-4 border-l-red-500' : 'border-layout-border'} flex flex-col md:flex-row justify-between items-center gap-4 transition-all hover:shadow-md">
            <div class="flex items-center gap-4 w-full">
                <div class="w-12 h-12 rounded-xl flex items-center justify-center text-xl 
                    ${lab.status === 'PASSED' ? 'bg-emerald-50 text-emerald-500' : 
                      lab.status === 'REJECTED' ? 'bg-red-50 text-red-500' : 
                      lab.status === 'PENDING' ? 'bg-orange-50 text-orange-500' : 'bg-slate-50 text-slate-400'}">
                    <i class="ph ph-file-text"></i>
                </div>
                <div>
                    <h3 class="font-bold text-slate-800">${lab.title}</h3>
                    <p class="text-xs text-gray-400">${lab.desc}</p>
                </div>
            </div>
            <div class="flex items-center gap-4 w-full md:w-auto justify-end">
                ${renderStatusUI(lab)}
            </div>
        </div>
    `).join('');
}

/**
 * จัดการแสดงผลปุ่มและสถานะตามเงื่อนไข (แก้ไขเป็น Pending ตามรูปภาพ)
 */
function renderStatusUI(lab) {
    switch (lab.status) {
        case 'PASSED':
            return `
                <div class="text-right mr-2">
                    <p class="text-[9px] text-gray-400 font-bold uppercase">Score</p>
                    <p class="text-emerald-600 font-bold leading-none">${lab.score}</p>
                </div>
                <span class="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-lg uppercase tracking-wider whitespace-nowrap">Passed</span>
                <button onclick="window.location.href='submissionResult.html'" class="px-6 py-2 border border-layout-border rounded-xl text-xs font-bold text-slate-600 hover:bg-gray-50 transition-colors whitespace-nowrap">View Results</button>
            `;
        case 'REJECTED':
            return `
                <span class="text-[10px] font-bold text-red-600 bg-red-50 px-3 py-1 rounded-lg uppercase tracking-wider whitespace-nowrap">Rejected</span>
                <button class="px-6 py-2 border border-red-200 rounded-xl text-xs font-bold text-red-500 hover:bg-red-50 transition-colors whitespace-nowrap">View Feedback</button>
            `;
        case 'PENDING':
            return `
                <span class="text-[10px] font-bold text-orange-500 bg-orange-50 px-3 py-1 rounded-lg uppercase tracking-wider flex items-center gap-1 whitespace-nowrap">
                    <i class="ph ph-circle-notch animate-spin"></i> Pending
                </span>
                <button class="px-6 py-2 bg-gray-100 rounded-xl text-xs font-bold text-gray-400 cursor-not-allowed whitespace-nowrap">Processing...</button>
            `;
        default:
            return `
                <span class="text-[10px] font-bold text-gray-400 bg-gray-100 px-3 py-1 rounded-lg uppercase tracking-wider whitespace-nowrap">Not Submitted</span>
                <button onclick="window.location.href='submissionPage.html'" class="px-8 py-2.5 bg-brand-500 text-white rounded-xl text-xs font-bold hover:bg-indigo-600 transition-all shadow-sm whitespace-nowrap">Submit Lab</button>
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
renderLabs();
simulateBackendCheck();