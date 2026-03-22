document.addEventListener("DOMContentLoaded", () => {
    
    // ==========================================
    // 1. ดึงข้อมูลจาก TA (taCreateLab) ผ่าน LocalStorage
    // ==========================================
    // หมายเหตุ: ไฟล์ taCreateLab.js ทำการเซฟข้อมูลลงใน key ที่ชื่อว่า 'currentLab'
    const storedLab = localStorage.getItem('currentLab');
    
    // ค่าเริ่มต้น (เผื่อกรณีไม่มีข้อมูลใน LocalStorage)
    let labName = "Auto Scaling Setup";
    let courseCode = "รหัสวิชา : CS232 (Sec: 1)";
    let totalImagesRequired = 1; 

    if (storedLab) {
        try {
            const labData = JSON.parse(storedLab);
            
            // ดึงชื่อ Lab
            if(labData.name) labName = labData.name;
            
            // ดึงรหัสวิชาและ Section
            if(labData.subject || labData.section) {
                courseCode = `รหัสวิชา : ${labData.subject || '-'} (Sec: ${labData.section || '-'})`;
            }

            // นับจำนวนรูปภาพที่ TA ตั้งค่าไว้ใน Array (labData.images)
            if (labData.images && labData.images.length > 0) {
                totalImagesRequired = labData.images.length;
            }
        } catch (e) {
            console.error("Error parsing lab data from localStorage", e);
        }
    }

    // นำข้อมูลที่ดึงมา อัปเดตขึ้นหน้าจอ
    document.getElementById('lab-title').textContent = labName;
    document.getElementById('course-code').textContent = courseCode;


    // ==========================================
    // 2. สร้าง Tab อัปโหลดรูปภาพ ตามจำนวนที่ TA กำหนด
    // ==========================================
    const imagesData = {};
    const tabsContainer = document.getElementById('tabs-container');
    tabsContainer.innerHTML = ''; 
    let currentTab = 1;

    for (let i = 1; i <= totalImagesRequired; i++) {
        imagesData[i] = null; // เตรียมที่ว่างเก็บภาพ

        const btn = document.createElement('button');
        btn.className = `tab-btn ${i === 1 ? 'active' : ''}`;
        btn.setAttribute('data-tab', i);
        btn.textContent = `ภาพที่ ${i}`;
        
        // เมื่อกดเปลี่ยน Tab
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
            btn.classList.add('active');
            currentTab = i;
            updateDropzoneView();
        });

        tabsContainer.appendChild(btn);
    }

    // ==========================================
    // 3. ระบบอัปโหลดและแสดงผลรูปภาพ (Dropzone)
    // ==========================================
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('file-input');
    const dropzoneContent = document.getElementById('dropzone-content');
    const imagePreview = document.getElementById('image-preview');
    const statusBadge = document.getElementById('status-badge');
    const statusText = document.getElementById('status-text');
    const statusIcon = document.getElementById('status-icon');

    // คลิกเลือกไฟล์
    dropzone.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) handleFileUpload(e.target.files[0]);
    });

    // ลากและวางไฟล์ (Drag & Drop)
    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
    });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) handleFileUpload(e.dataTransfer.files[0]);
    });

    function handleFileUpload(file) {
        if (!file.type.startsWith('image/')) {
            alert('ระบบรองรับเฉพาะไฟล์รูปภาพ (.jpg, .png) เท่านั้นครับ');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            imagesData[currentTab] = e.target.result; // เซฟรูปใน Tab ปัจจุบัน
            updateDropzoneView();
            checkOverallStatus(); // เช็คว่าส่งครบหรือยัง
        };
        reader.readAsDataURL(file);
    }

    function updateDropzoneView() {
        if (imagesData[currentTab]) {
            imagePreview.src = imagesData[currentTab];
            imagePreview.style.display = 'block';
            dropzoneContent.style.display = 'none';
        } else {
            imagePreview.src = '';
            imagePreview.style.display = 'none';
            dropzoneContent.style.display = 'flex';
        }
        fileInput.value = ""; 
    }

    // ==========================================
    // 4. ตรวจสอบสถานะภาพรวม (เปลี่ยนป้ายเป็น FULLY UPLOADED)
    // ==========================================
    function checkOverallStatus() {
        let isAllUploaded = true;
        
        for (let i = 1; i <= totalImagesRequired; i++) {
            if (!imagesData[i]) {
                isAllUploaded = false;
                break;
            }
        }

        if (isAllUploaded) {
            statusBadge.classList.replace('pending', 'uploaded');
            statusText.textContent = "FULLY UPLOADED";
            statusIcon.innerHTML = `
                <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z"/>
            `;
        } else {
            statusBadge.classList.replace('uploaded', 'pending');
            statusText.textContent = "PENDING UPLOAD";
            statusIcon.innerHTML = `
                <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
                <path d="M7.002 11a1 1 0 1 1 2 0 1 1 0 0 1-2 0zM7.1 4.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 4.995z"/>
            `;
        }
    }
});

// ==========================================
// ฟังก์ชันส่งงาน (ลิงก์ไปหน้า Result)
// ==========================================
function submitLab() {
    // 1. เช็คก่อนว่าอัปโหลดรูปครบหรือยัง (ถ้าบังคับให้ส่งครบ)
    const statusText = document.getElementById('status-text').textContent;
    if (statusText !== "FULLY UPLOADED") {
        alert("กรุณาอัปโหลดรูปภาพให้ครบทุกแท็บก่อนส่งงานครับ");
        return; // หยุดการทำงาน ไม่ให้เปลี่ยนหน้า
    }

    // 2. ดึงชื่อ Lab ปัจจุบันเพื่อส่งไปให้หน้า Result
    const labTitle = document.getElementById('lab-title').textContent;
    localStorage.setItem('lastSubmittedLab', labTitle);

    // 3. เปลี่ยนไปหน้า Result
    window.location.href = "submissionResult.html";
}