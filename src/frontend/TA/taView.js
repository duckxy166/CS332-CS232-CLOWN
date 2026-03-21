const db = firebase.database();

/**
 * ดึงข้อมูลแล็บจาก Firebase และแสดงผลบนหน้าจอ
 */
function listenToLabs() {
    const labRef = db.ref('labs');
    const container = document.getElementById('lab-list-container');

    labRef.on('value', (snapshot) => {
        if (!container) return;
        container.innerHTML = ''; 

        if (!snapshot.exists()) {
            container.innerHTML = `<div style="text-align:center; padding:50px; color:#888;">ยังไม่มีรายการแล็บ</div>`;
            return;
        }

        snapshot.forEach((childSnapshot) => {
            const labId = childSnapshot.key;
            const lab = childSnapshot.val();

            // ดึงข้อมูลตัวเลข (ตั้งค่าเริ่มต้นถ้าไม่มีข้อมูล)
            const submitted = lab.submittedCount || 0;
            const total = lab.totalStudents || 65;
            const pending = lab.pendingCount || 0;

            const labCard = document.createElement('div');
            labCard.className = 'lab-card-modern';
            labCard.innerHTML = `
                <div class="lab-info-main" onclick="editLab('${labId}')">
                    <div class="lab-icon-box">
                        <i class="fa-regular fa-file-lines"></i>
                    </div>
                    <div class="lab-text-content">
                        <h3 class="lab-name-title">${lab.labName || 'Untitled Lab'}</h3>
                        <p class="lab-sub-detail">${lab.subject || '-'} - section ${lab.section || '-'}</p>
                    </div>
                </div>

                <div class="lab-stats-group">
                    <div class="stat-item">
                        <span class="stat-label">ส่งแล้ว</span>
                        <span class="stat-value"><strong>${submitted}/${total}</strong></span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">รอตรวจสอบ</span>
                        <span class="stat-value pending-text">${pending}</span>
                    </div>
                </div>

                <div class="lab-actions">
                    <button class="btn-download-outline" onclick="downloadAllImages('${labId}', '${lab.labName}')">
                        <i class="fa-solid fa-download"></i> โหลดภาพทั้งหมด
                    </button>
                    <i class="fa-solid fa-trash-can delete-icon" onclick="deleteLab('${labId}')"></i>
                </div>
            `;
            container.appendChild(labCard);
        });
    });
}

/**
 * นำทางไปยังหน้าสร้างแล็บเพื่อ "แก้ไข" ข้อมูลเดิม
 */
function editLab(labId) {
    // ส่ง id ผ่าน URL เพื่อให้หน้าสร้างแล็บดึงข้อมูลเก่ามาแสดง
    window.location.href = `taCreateLab_PAGE.html?editId=${labId}`;
}

/**
 * ลบ Lab ออกจาก Database
 */
function deleteLab(labId) {
    if (confirm("⚠️ คุณต้องการลบกล่องแล็บนี้ใช่หรือไม่? ข้อมูลทั้งหมดจะถูกลบถาวร")) {
        db.ref(`labs/${labId}`).remove()
            .then(() => alert("ลบข้อมูลสำเร็จ"))
            .catch((error) => alert("เกิดข้อผิดพลาด: " + error.message));
    }
}

/**
 * จำลองการดาวน์โหลดรูปภาพ
 */
function downloadAllImages(labId, labName) {
    alert(`ระบบกำลังเตรียมรวบรวมไฟล์ภาพจากแล็บ: ${labName}`);
    // ส่วนนี้จะเชื่อมต่อกับระบบ Storage ของคุณในอนาคต
}

function updateClassName() {
    const urlParams = new URLSearchParams(window.location.search);
    const className = urlParams.get('class'); 
    const displayElement = document.getElementById('class-name-display');
    if (displayElement) {
        displayElement.innerText = className || "CS232";
    }
}

// เริ่มการทำงานเมื่อโหลดหน้า
window.onload = function() {
    updateClassName();
    if (typeof firebase !== 'undefined') {
        listenToLabs();
    }
};