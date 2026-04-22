// ฟังก์ชันสลับสถานะหน้าจอ
function updateResultView(state) {
    // ซ่อนทุกหน้าก่อน
    document.querySelectorAll('.status-view').forEach(view => {
        view.classList.add('hidden');
    });

    // แสดงหน้าที่ต้องการ (processing, passed, rejected)
    const target = document.getElementById('state-' + state);
    if (target) {
        target.classList.remove('hidden');
    }
}

/**
 * ตัวอย่างการใช้งาน:
 * เมื่อโหลดหน้ามา ให้เริ่มที่ 'processing'
 * จากนั้นรอฟังผลจาก Backend (เช่น fetch API)
 */
window.addEventListener('DOMContentLoaded', () => {
    // ทดสอบสลับหน้าหลังจากผ่านไป 3 วินาที
    setTimeout(() => {
        // เปลี่ยนเป็น 'passed' หรือ 'rejected' ตามผลจาก backend
        updateResultView('passed'); 
    }, 3000);
});