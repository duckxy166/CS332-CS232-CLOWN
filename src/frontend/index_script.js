// 1. ฟังก์ชันถอดรหัส Token
        function parseJwt(token) {
            try {
                const base64Url = token.split('.')[1];
                const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
                const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
                    return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
                }).join(''));
                return JSON.parse(jsonPayload);
            } catch (e) {
                return null;
            }
        }

        // 2. ฟังก์ชันแยกหน้า
        function routeUser(token) {
            const userData = parseJwt(token);
            if (userData) {
                // ซ่อนปุ่ม Login และโชว์ข้อความกำลังโหลด
                document.querySelector('.login-btn').style.display = 'none';
                document.getElementById('loadingMessage').style.display = 'block';

                const userRole = userData['custom:role'] || userData['role'];
                
                // หน่วงเวลา 1 วิให้ระบบโหลดเสร็จแล้วค่อยเปลี่ยนหน้า
                setTimeout(() => {
                    if (userRole && userRole.toLowerCase() === 'ta') {
                        window.location.replace("TA/Ta_Dashboard.html");
                    } else {
                        window.location.replace("student/student_dashboard.html");
                    }
                }, 1000);
            } else {
                alert("ข้อมูลเข้าสู่ระบบไม่สมบูรณ์ กรุณาลองใหม่อีกครั้ง");
            }
        }

        // ==========================================
        // 🌟 3. จุดเริ่มต้นการทำงานเมื่อโหลดหน้าเว็บ
        // ==========================================
        
        // เช็คว่ามี Token ห้อยมากับ URL ไหม (กรณีเพิ่งล็อกอินเสร็จและเด้งกลับมา)
        const hash = window.location.hash.substring(1);
        const urlParams = new URLSearchParams(hash);
        const tokenFromUrl = urlParams.get('id_token');

        if (tokenFromUrl) {
            // ดัก Token ได้ -> เซฟลงเครื่อง -> ล้าง URL ให้สะอาด -> แยกหน้า
            localStorage.setItem('cognito_id_token', tokenFromUrl);
            window.history.replaceState(null, null, window.location.pathname);
            routeUser(tokenFromUrl);
        } else {
            // ถ้าไม่มี Token ใน URL ให้ไปค้นในเครื่องดูว่าเคยล็อกอินค้างไว้ไหม
            const savedToken = localStorage.getItem('cognito_id_token');
            if (savedToken) {
                // ถ้าเคยล็อกอินไว้แล้ว ก็ไม่ต้องรอให้กดปุ่ม เตะเข้าหน้าหลักเลย
                routeUser(savedToken);
            }
            // แต่ถ้าในเครื่องก็ไม่มี Token โค้ดก็จะจบแค่นี้ และปล่อยให้ผู้ใช้เห็น "ปุ่ม Login" ตามปกติครับ
        }