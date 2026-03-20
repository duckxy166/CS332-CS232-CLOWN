// ==========================================
// 1. Mock Data (จำลองข้อมูลที่ตอบกลับมาจาก Backend)
// ==========================================

// กรณีที่ 1: ผ่านทั้งหมด (นำมาใช้เป็นค่าเริ่มต้น)
const mockDataSuccess = {
    labId: "Lab 01: xxxxxxxxxxxxxxx",
    isOverallSuccess: true,
    steps: [
        { task: "successfully created", status: "success" },
        { task: "integration-lab", status: "success" },
        { task: "us-east-1", status: "success" }
    ]
};

// กรณีที่ 2: มีบางอันไม่ผ่าน (เตรียมไว้เผื่อทดสอบ)
const mockDataFailed = {
    labId: "Lab 01: xxxxxxxxxxxxxxx",
    isOverallSuccess: false,
    steps: [
        { task: "successfully created", status: "success" },
        { task: "integration-lab", status: "failed" }, 
        { task: "us-east-1", status: "success" }
    ]
};

// ==========================================
// 2. ฟังก์ชันหลักสำหรับ Render ข้อมูลลงหน้าจอ
// ==========================================
function renderResult(data) {
    const headerContainer = document.getElementById('main-status-header');
    const mainIcon = document.getElementById('main-status-icon');
    const mainText = document.getElementById('main-status-text');
    const labNameText = document.getElementById('lab-name');
    const listContainer = document.getElementById('status-list-container');

    // อัปเดตชื่อ Lab
    labNameText.textContent = data.labId;

    // ตรวจสอบสถานะภาพรวม
    if (data.isOverallSuccess) {
        headerContainer.classList.remove('is-failed');
        mainIcon.textContent = "✓";
        mainText.textContent = "ผ่านการตรวจสอบ";
    } else {
        headerContainer.classList.add('is-failed');
        mainIcon.textContent = "✗";
        mainText.textContent = "ไม่ผ่านการตรวจสอบ";
    }

    // ล้างข้อมูลเดิมและวาดรายการสถานะย่อย
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
// 3. จำลองการดึง API เมื่อหน้าเว็บโหลดเสร็จ
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    
    // จำลองเวลาดีเลย์เหมือนกำลังดึง API (0.5 วินาที)
    setTimeout(() => {
        // *** เปลี่ยนตรงนี้เป็น mockDataSuccess เพื่อให้ขึ้นสถานะผ่านทั้งหมด ***
        renderResult(mockDataSuccess); 
    }, 500);

});

// ==========================================
// 4. ฟังก์ชันของปุ่มต่างๆ
// ==========================================
function goBack() {
    alert("ระบบกำลังพากลับสู่หน้าหลัก");
    // window.location.href = "/home";
}

function viewEvidence() {
    alert("กำลังเปิดไฟล์หลักฐาน");
}

// ==========================================
// ฟังก์ชันของปุ่มต่างๆ
// ==========================================
function goBack() {
    // เปลี่ยนเส้นทางไปที่ไฟล์ student_dashboard.html ที่อยู่ในโฟลเดอร์เดียวกัน
    window.location.href = "student_dashboard.html";
}

function viewEvidence() {
    alert("กำลังเปิดไฟล์หลักฐาน");
}