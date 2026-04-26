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

function getResultState() {
    const params = new URLSearchParams(window.location.search);
    const state = params.get('state');
    return ['processing', 'passed', 'failed'].includes(state) ? state : null;
}

/**
 * ตัวอย่างการใช้งาน:
 * เมื่อโหลดหน้ามา ให้เริ่มที่ 'processing'
 * จากนั้นรอฟังผลจาก Backend (เช่น fetch API)
 */
window.addEventListener('DOMContentLoaded', () => {
    const state = getResultState() || 'processing';
    updateResultView(state);

    if (state === 'processing') {
        setTimeout(() => {
            updateResultView('passed');
        }, 3000);
    }
});