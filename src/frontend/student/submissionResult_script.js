// ==========================================
// 1. Mock Data (ข้อมูลจำลอง)
// ==========================================
const mockDataSuccess = {
    labId: "Lab 01: xxxxxxxxxxxxxxx",
    isOverallSuccess: true,
    steps: [
        { task: "successfully created", status: "success" },
        { task: "integration-lab", status: "success" },
        { task: "us-east-1", status: "success" }
    ]
};

// ==========================================
// 2. ฟังก์ชันหลักสำหรับแสดงผล
// ==========================================
function renderResult(data) {
    const headerContainer = document.getElementById('main-status-header');
    const mainIcon = document.getElementById('main-status-icon');
    const mainText = document.getElementById('main-status-text');
    const labNameText = document.getElementById('lab-name');
    const listContainer = document.getElementById('status-list-container');

    if (!headerContainer || !listContainer) return;

    // อัปเดตชื่อ Lab
    labNameText.textContent = data.labId;

    // เปลี่ยนสีและข้อความตามสถานะ
    if (data.isOverallSuccess) {
        headerContainer.classList.remove('is-failed');
        mainIcon.textContent = "✓";
        mainText.textContent = "ผ่านการตรวจสอบ";
    } else {
        headerContainer.classList.add('is-failed');
        mainIcon.textContent = "✗";
        mainText.textContent = "ไม่ผ่านการตรวจสอบ";
    }

    // วาดรายการย่อย
    listContainer.innerHTML = ''; 
    data.steps.forEach(step => {
        const isSuccess = step.status === 'success';
        const iconClass = isSuccess ? 'success' : 'failed';
        const iconSymbol = isSuccess ? '✓' : '✗';

        const itemHTML = `
            <div class="status-item">
                <span class="status-icon ${iconClass}">${iconSymbol}</span>
                <span class="status-text">${step.task}</span>
            </div>
        `;
        listContainer.insertAdjacentHTML('beforeend', itemHTML);
    });
}

// ==========================================
// 3. เริ่มทำงานเมื่อเปิดหน้าเว็บ
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // หน่วงเวลา 0.5 วิ ให้เหมือนโหลดจริง แล้วค่อยแสดงข้อมูล
    setTimeout(() => {
        renderResult(mockDataSuccess); 
    }, 500);
});

// ==========================================
// 4. ฟังก์ชันปุ่มกด
// ==========================================
function goBack() {
    window.location.href = "student_dashboard.html";
}

function viewEvidence() {
    alert("กำลังเปิดไฟล์หลักฐาน");
}