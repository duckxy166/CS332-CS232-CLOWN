 // ฟังก์ชันสำหรับสลับหน้าจอ
    function showStatus(statusId) {
      document.querySelectorAll('.status-card').forEach(card => {
        card.classList.remove('active');
      });
      document.getElementById('status-' + statusId).classList.add('active');
    }

    // ฟังก์ชันจำลองการรอ Backend (คุณสามารถนำไปประยุกต์ใช้กับ fetch API จริงได้)
    function simulateProcess() {
      showStatus('processing');

      // จำลองการรอ 3 วินาที
      setTimeout(() => {
        // สุ่มผลลัพธ์: 80% สำเร็จ, 20% ล้มเหลว
        const isSuccess = Math.random() > 0.2;
        
        if (isSuccess) {
          showStatus('success');
        } else {
          showStatus('error');
        }
      }, 3000);
    }

    // เริ่มทำงานเมื่อเปิดหน้าจอ (สำหรับทดสอบ)
    window.onload = simulateProcess;