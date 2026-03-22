// Firebase Config - ตรวจสอบค่าของคุณให้ถูกต้อง
const firebaseConfig = { databaseURL: "https://your-project-id.firebaseio.com" }; // !!! อย่าลืมแก้ตรงนี้ !!!

// ตรวจสอบความซ้ำซ้อนของการ initialize App
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
} else {
    firebase.app(); // ใช้งาน app ที่มีอยู่แล้ว
}
const db = firebase.database();

document.addEventListener('DOMContentLoaded', function() {
    
    // ══════════════════════════════════════════
    // 1. STATE MANAGEMENT (สถานะข้อมูล)
    // ══════════════════════════════════════════
    let appState = {
        // ข้อมูลรูปภาพ (Reference Images)
        images: [{ 
            id: Date.now(), 
            file: null, 
            preview: "", 
            passThreshold: 75,
            useTotalScore: true,
            useMandatory: true
        }],
        // ข้อมูลกฎ (AI/Key Rules) - เก็บแยก tabId
        rules: {}, 
        // แท็บที่กำลังทำงานอยู่ (Active Image ID)
        activeTabId: null,
        counter: 1 // สำหรับชื่อ default 'รูปที่ X'
    };

    // ตั้งค่า activeTabInitial
    appState.activeTabId = appState.images[0].id;
    // สร้าง Array กฎเริ่มต้นสำหรับรูปแรก
    appState.rules[appState.activeTabId] = [];

    // ══════════════════════════════════════════
    // 2. DOM ELEMENTS (อ้างอิง HTML)
    // ══════════════════════════════════════════
    const tabContainer = document.getElementById('tabContainer');
    const addTabBtn = document.getElementById('addTabBtn');
    const uploadZone = document.getElementById('uploadZone');
    const fileInput = document.getElementById('fileInput');
    const previewContainer = document.getElementById('previewContainer');
    const uploadPrompt = document.getElementById('uploadPrompt');
    const imagePreview = document.getElementById('imagePreview');
    const currentTabLabel = document.getElementById('currentTabLabel');
    
    const rulesListContainer = document.getElementById('rulesListContainer');
    const addRuleBtn = document.getElementById('addRuleBtn');
    const addRuleTabLabel = document.getElementById('addRuleTabLabel');
    const wbarBlocksContainer = document.getElementById('wbarBlocksContainer');

    const modal = document.getElementById("infoModal");

    // ══════════════════════════════════════════
    // 3. UTILITY FUNCTIONS (ฟังก์ชันช่วยเหลือ)
    // ══════════════════════════════════════════
    
    // ค้นหา Image Object จาก ID
    const findImageById = (id) => appState.images.find(img => img.id === id);
    
    // หา Index (ลำดับที่) ของรูปภาพใน Array (เริ่มต้นที่ 1)
    const getImageIndex = (id) => appState.images.findIndex(img => img.id === id) + 1;
    
    // คำนวณผลรวม Weight ของรูปภาพปัจจุบัน
    const calculateTotalWeight = (tabId) => {
        const rules = appState.rules[tabId] || [];
        return rules.reduce((sum, rule) => sum + parseInt(rule.weight || 0), 0);
    };

    // กำหนด Class ของสีตามคะแนน (สไตล์ภาพ 1)
    const getScoreClass = (totalWeight) => {
        if (totalWeight === 100) return 'score-ok'; // เขียว
        if (totalWeight > 100) return 'score-over'; // แดง
        return 'score-under'; // ส้ม
    };

    // กำหนดสี Fill ของ Progress Bar
    const getFillColor = (totalWeight) => {
        if (totalWeight === 100) return '#2ECC71'; // Green
        if (totalWeight > 100) return '#E74C3C'; // Red
        return '#F39C12'; // Orange
    };

    // ══════════════════════════════════════════
    // 4. IMAGE TABS RENDERER (จัดการแท็บรูปภาพ)
    // ══════════════════════════════════════════
    function renderTabs() {
        // ลบแท็บเก่า ยกเว้นปุ่มบวก
        tabContainer.querySelectorAll('.tab').forEach(t => t.remove());

        appState.images.forEach((img, index) => {
            const tab = document.createElement('button');
            tab.type = "button";
            tab.className = `tab ${img.id === appState.activeTabId ? 'active' : ''}`;
            
            // ถ้ามีรูปเดียว ไม่ให้มีปุ่มปิด
            const closeHtml = appState.images.length > 1 ? `<span class="close-tab" data-id="${img.id}">&times;</span>` : '';
            tab.innerHTML = `รูปที่ ${index + 1} ${closeHtml}`;
            
            // เหตุการณ์คลิกเพื่อสลับแท็บ
            tab.onclick = (e) => {
                // ถ้าคลิกโดน x (close-tab) ไม่ต้องสลับ
                if (e.target.classList.contains('close-tab')) return;
                switchTab(img.id);
            };

            // เหตุการณ์คลิกปุ่มปิด (X)
            const closeBtn = tab.querySelector('.close-tab');
            if (closeBtn) {
                closeBtn.onclick = (e) => {
                    e.stopPropagation(); // หยุดการลามของอีเวนต์
                    deleteImageTab(img.id);
                };
            }
            tabContainer.insertBefore(tab, addTabBtn);
        });
    }

    // ฟังก์ชันสลับแท็บ
    function switchTab(tabId) {
        appState.activeTabId = tabId;
        renderTabs();
        updateUploadZone();
        renderRules();
        renderWeightSummary();
    }

    // ฟังก์ชันเพิ่มแท็บใหม่
    addTabBtn.addEventListener('click', function(e) {
        e.preventDefault(); e.stopPropagation();
        const newId = Date.now();
        
        // เพิ่ม Image State
        appState.images.push({ 
            id: newId, file: null, preview: "", 
            passThreshold: 75, useTotalScore: true, useMandatory: true
        });
        
        // เพิ่ม Rules State พื้นที่ว่างสำหรับรูปใหม่
        appState.rules[newId] = [];
        
        appState.activeTabId = newId;
        renderTabs();
        updateUploadZone();
        renderRules();
        renderWeightSummary();
    });

    // ฟังก์ชันลบแท็บรูปภาพ
    function deleteImageTab(tabIdToDelete) {
        // ไม่อนุญาตให้ลบถ้ารูปภาพเหลือรูปเดียว
        if (appState.images.length <= 1) return;

        // ดึงลำดับที่จะลบเพื่อเอาไปแสดงใน confirm
        const indexToDel = getImageIndex(tabIdToDelete);

        if (confirm(`คุณต้องการลบ "รูปที่ ${indexToDel}" และ AI Rules ทั้งหมดที่ผูกอยู่หรือไม่?`)) {
            // ลบ Image Object
            appState.images = appState.images.filter(img => img.id !== tabIdToDelete);
            // ลบ Rules Data ที่ผูกอยู่
            delete appState.rules[tabIdToDelete];

            // ถ้าลบแท็บที่กำลัง active อยู่ ให้สลับไปที่แท็บแรก
            if (appState.activeTabId === tabIdToDelete) {
                appState.activeTabId = appState.images[0].id;
            }
            
            renderTabs();
            updateUploadZone();
            renderRules();
            renderWeightSummary();
        }
    }

    // ══════════════════════════════════════════
    // 5. UPLOAD ZONE LOGIC (จัดการการอัปโหลดรูป)
    // ══════════════════════════════════════════
    function updateUploadZone() {
        const currentImgObj = findImageById(appState.activeTabId);
        const currentIndex = getImageIndex(appState.activeTabId);
        currentTabLabel.innerText = `รูปที่ ${currentIndex}`;
        addRuleTabLabel.innerText = `รูปที่ ${currentIndex}`; // อัปเดตฉลากตรงปุ่มเพิ่มกฎด้วย

        if (currentImgObj && currentImgObj.preview) {
            imagePreview.src = currentImgObj.preview;
            previewContainer.style.display = 'block';
            uploadPrompt.style.display = 'none';
        } else {
            previewContainer.style.display = 'none';
            uploadPrompt.style.display = 'block';
        }
    }

    // จัดการการคลิกบน Upload Zone
    uploadZone.onclick = function(e) {
        // ถ้าคลิกโดนปุ่ม ลบ ไม่ต้องเปิด file input
        if (e.target.id === 'deleteImgBtn') return;
        fileInput.click();
    };

    // จัดการการเลือกไฟล์
    fileInput.onchange = function(e) {
        const file = e.target.files[0];
        if (file) {
            // ตรวจสอบขนาดไฟล์
            if (file.size > 5 * 1024 * 1024) {
                alert("ไฟล์ขนาดเกิน 5MB! กรุณาเลือกไฟล์ใหม่");
                fileInput.value = ""; return;
            }
            const reader = new FileReader();
            reader.onload = function(event) {
                const currentImgObj = findImageById(appState.activeTabId);
                currentImgObj.preview = event.target.result;
                currentImgObj.file = file; // เก็บไฟล์ดิบไว้ส่ง Firebase สตอเรจ
                updateUploadZone();
            };
            reader.readAsDataURL(file);
        }
    };

    // ปุ่มลบรูป
    document.getElementById('deleteImgBtn').onclick = function(e) {
        e.stopPropagation(); // ไม่ให้คลิก ZONE ทำงาน
        const currentImgObj = findImageById(appState.activeTabId);
        currentImgObj.preview = "";
        currentImgObj.file = null;
        fileInput.value = ""; // รีเซ็ต input file
        updateUploadZone();
    };

    // ══════════════════════════════════════════
    // 6. KEY RULES LOGIC (จัดการกฎ -> โครงสร้างภาพ 1)
    // ══════════════════════════════════════════
    
    // ฟังก์ชัน Render รายการกฎของรูปภาพปัจจุบัน
    function renderRules() {
        // เคลียร์รายการเก่า
        rulesListContainer.innerHTML = '';
        const currentRules = appState.rules[appState.activeTabId] || [];

        currentRules.forEach((rule, index) => {
            const ruleItem = document.createElement('div');
            ruleItem.className = 'rule-item';
            
            // โครงสร้าง HTML ของกฎ 1 ข้อ (โครงสร้างภาพ 1)
            ruleItem.innerHTML = `
                <div class="rule-num">${index + 1}</div>
                <div class="keyword-input-wrapper">
                    <input type="text" class="keyword-input" 
                           placeholder="เช่น Bucket 'integr-lab-cs232' successfully created" 
                           value="${rule.keyword}" data-id="${rule.id}">
                    
                    <div class="pos-rule-section">
                        <label class="toggle-pos-label">
                            <input type="checkbox" ${rule.usePosition ? 'checked' : ''} data-id="${rule.id}">
                            <span class="pos-rule-text">SET Text Position Rule</span>
                        </label>
                    </div>

                    <div class="sensitivity-panel ${rule.usePosition ? 'visible' : ''}" id="sens-panel-${rule.id}">
                        <div class="sens-title">Sensitivity — ความคลาดเคลื่อนที่ยอมรับได้</div>
                        <div class="sens-options">
                            <button class="sens-btn ${rule.sensitivity === 'low' ? 'active' : ''}" data-sens="low" data-id="${rule.id}">Low <span class="d-none">±30%</span></button>
                            <button class="sens-btn ${rule.sensitivity === 'medium' ? 'active' : ''}" data-sens="medium" data-id="${rule.id}">Medium <span class="d-none">±15%</span></button>
                            <button class="sens-btn ${rule.sensitivity === 'high' ? 'active' : ''}" data-sens="high" data-id="${rule.id}">High <span class="d-none">±5%</span></button>
                        </div>
                    </div>
                </div>
                <div class="weight-input-wrapper">
                    <input type="number" class="weight-input" value="${rule.weight}" 
                           placeholder="0" min="0" max="100" data-id="${rule.id}">
                    <span class="weight-unit">%</span>
                </div>
                <button class="delete-rule-btn" data-id="${rule.id}">&times;</button>
            `;
            
            // ผูกเหตุการณ์ต่างๆ ให้ Element ภายในกฎข้อนี้
            bindRuleEvents(ruleItem);
            rulesListContainer.appendChild(ruleItem);
        });
    }

    // ผูกเหตุการณ์ภายในกฎแต่ละข้อ (ใช้ Event Delegation ไม่ได้ทั้งหมดเพราะต้องการ Update แยก)
    function bindRuleEvents(ruleHtml) {
        // อัปเดต Keyword
        ruleHtml.querySelector('.keyword-input').addEventListener('input', function() {
            const id = this.getAttribute('data-id');
            const rule = appState.rules[appState.activeTabId].find(r => r.id == id);
            rule.keyword = this.value;
            renderWeightSummary(); // อัปเดตบล็อกสรุปด้านล่างทันที
        });

        // อัปเดต Weight
        ruleHtml.querySelector('.weight-input').addEventListener('input', function() {
            const id = this.getAttribute('data-id');
            const rule = appState.rules[appState.activeTabId].find(r => r.id == id);
            rule.weight = this.value;
            renderWeightSummary(); // อัปเดตบล็อกสรุป (Progress Bar) ทันที
        });

        // ติ๊ก SET Text Position
        ruleHtml.querySelector('.toggle-pos-label input').addEventListener('change', function() {
            const id = this.getAttribute('data-id');
            const rule = appState.rules[appState.activeTabId].find(r => r.id == id);
            rule.usePosition = this.checked;
            
            // แสดง/ซ่อน แผง Sensitivity
            document.getElementById(`sens-panel-${id}`).classList.toggle('visible', this.checked);
            renderWeightSummary(); // อัปเดต Badge ด้านล่าง
        });

        // คลิกเลือก Sensitivity (สไตล์ภาพ 2)
        ruleHtml.querySelectorAll('.sens-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const id = this.getAttribute('data-id');
                const sens = this.getAttribute('data-sens');
                const rule = appState.rules[appState.activeTabId].find(r => r.id == id);
                rule.sensitivity = sens;
                
                // อัปเดต UI ปุ่ม
                ruleHtml.querySelectorAll('.sens-btn').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
            });
        });

        // คลิกปุ่มลบกฎ
        ruleHtml.querySelector('.delete-rule-btn').addEventListener('click', function() {
            const id = this.getAttribute('data-id');
            appState.rules[appState.activeTabId] = appState.rules[appState.activeTabId].filter(r => r.id != id);
            renderRules();
            renderWeightSummary();
        });
    }

    // ปุ่มเพิ่มกฎใหม่
    addRuleBtn.addEventListener('click', function() {
        const activeTabId = appState.activeTabId;
        // ตั้งค่ากฎเริ่มต้น
        appState.rules[activeTabId].push({
            id: Date.now(),
            keyword: "",
            weight: "",
            usePosition: false,
            sensitivity: "medium", // ค่าเริ่มต้น (ตามภาพ 2)
            isMandatory: false
        });
        renderRules();
        renderWeightSummary();
    });

    // ══════════════════════════════════════════
    // 7. SUMMARY AREA LOGIC (บล็อกสีฟ้าด้านล่าง -> โครงสร้างภาพ 1)
    // ══════════════════════════════════════════
    function renderWeightSummary() {
        wbarBlocksContainer.innerHTML = '';

        // Render บล็อกสรุป Weight ของทุกรูปที่มี
        appState.images.forEach((img, index) => {
            const tabId = img.id;
            const rules = appState.rules[tabId] || [];
            const totalWeight = calculateTotalWeight(tabId);
            const scoreClass = getScoreClass(totalWeight);
            const fillColor = getFillColor(totalWeight);

            const wbarBlock = document.createElement('div');
            wbarBlock.className = 'wbar-block';
            wbarBlock.innerHTML = `
                <div class="wbar-header">
                    <span class="wbar-title">รูปที่ ${index + 1}</span>
                    <span class="wbar-score-display ${scoreClass}">${totalWeight} / 100%</span>
                </div>
                
                <div class="wbar-track">
                    <div class="wbar-fill" style="width: ${Math.min(totalWeight, 100)}%; background: ${fillColor}"></div>
                </div>

                <div class="summary-rules-list">
                    ${rules.length === 0 ? '<div class="text-sub" style="font-size:12px; font-style:italic;">ยังไม่มี AI Rules ในรูปนี้</div>' : ''}
                    ${rules.map(r => `
                        <div class="summary-rule-item">
                            <div class="rule-dot" style="background: ${getFillColor(parseInt(r.weight || 0))}"></div>
                            <span class="rule-kw-text ${!r.keyword ? 'unnamed-kw' : ''}">${r.keyword || '(ยังไม่ระบุ Keyword)'}</span>
                            <span>
                                ${r.usePosition ? 
                                    '<span class="badge badge-orange">KEYWORD + POSITION</span>' : 
                                    '<span class="badge badge-blue">KEYWORD ONLY</span>'}
                            </span>
                            <span class="summary-weight-val">${r.weight || 0}%</span>
                        </div>
                    `).join('')}
                </div>

                <div class="threshold-section">
                    <div class="thresh-title">Pass Threshold</div>
                    <div class="thresh-row-group">
                        
                        <div class="thresh-row">
                            <div class="thresh-left">
                                <input type="checkbox" class="thresh-main-cb total-score-cb" 
                                       ${img.useTotalScore ? 'checked' : ''} data-id="${img.id}">
                                <label class="thresh-label">Total Score</label>
                            </div>
                            <div class="thresh-input-area">
                                <span class="symbol-geq">≥</span>
                                <input type="number" class="thresh-input total-score-val" 
                                       value="${img.passThreshold}" min="0" max="100" data-id="${img.id}">
                                <span class="percent-sign">%</span>
                            </div>
                        </div>

                        <div class="thresh-row">
                            <div class="thresh-left">
                                <input type="checkbox" class="thresh-main-cb mand-rules-cb" 
                                       ${img.useMandatory ? 'checked' : ''} data-id="${img.id}">
                                <label class="thresh-label">Mandatory Rules</label>
                            </div>
                        </div>

                        ${img.useMandatory && rules.length > 0 ? `
                            <div class="mandatory-list">
                                ${rules.filter(r => r.keyword).map(r => `
                                    <div class="mandatory-rule-item">
                                        <span>
                                            ${r.usePosition ? 
                                                '<span class="badge badge-orange">KEYWORD + POSITION</span>' : 
                                                '<span class="badge badge-blue">KEYWORD ONLY</span>'}
                                        </span>
                                        <span class="mand-kw-name">${r.keyword}</span>
                                        
                                        <label class="tog-switch">
                                            <span class="mand-text">Mandatory</span>
                                            <div class="switch-box">
                                                <input type="checkbox" class="mand-rule-switch" 
                                                       ${r.isMandatory ? 'checked' : ''} 
                                                       data-rule-id="${r.id}" data-tab-id="${tabId}">
                                                <span class="switch-slider"></span>
                                            </div>
                                        </label>
                                    </div>
                                `).join('')}
                            </div>
                        ` : ''}

                    </div>
                </div>
            `;
            wbarBlocksContainer.appendChild(wbarBlock);
        });

        // ผูกเหตุการณ์ภายในส่วน Threshold
        bindThresholdEvents();
    }

    // ฟังก์ชันผูกเหตุการณ์ในบล็อกสรุป Threshold
    function bindThresholdEvents() {
        // ติ๊ก Total Score (เงื่อนไขใหญ่)
        wbarBlocksContainer.querySelectorAll('.total-score-cb').forEach(cb => {
            cb.onchange = function() {
                const imgId = parseInt(this.getAttribute('data-id'));
                findImageById(imgId).useTotalScore = this.checked;
                // ในภาพ 1 Total Score ติ๊กไว้เสมอ แต่อันนี้ทำเผื่อสลับ
            };
        });

        // อัปเดต % Threshold
        wbarBlocksContainer.querySelectorAll('.total-score-val').forEach(input => {
            input.oninput = function() {
                const imgId = parseInt(this.getAttribute('data-id'));
                findImageById(imgId).passThreshold = this.value;
            };
        });

        // ติ๊ก Mandatory Rules (เงื่อนไขใหญ่)
        wbarBlocksContainer.querySelectorAll('.mand-rules-cb').forEach(cb => {
            cb.onchange = function() {
                const imgId = parseInt(this.getAttribute('data-id'));
                findImageById(imgId).useMandatory = this.checked;
                renderWeightSummary(); // Re-render เพื่อแสดง/ซ่อน รายการ
            };
        });

        // สวิตช์ Mandatory สีแดง (แต่ละกฎ)
        wbarBlocksContainer.querySelectorAll('.mand-rule-switch').forEach(cb => {
            cb.onchange = function() {
                const ruleId = parseInt(this.getAttribute('data-rule-id'));
                const tabId = parseInt(this.getAttribute('data-tab-id'));
                const rule = appState.rules[tabId].find(r => r.id === ruleId);
                rule.isMandatory = this.checked;
            };
        });
    }

    // ══════════════════════════════════════════
    // 8. DATA DROPDOWN & INIT (Firebase & Start)
    // ══════════════════════════════════════════
    
    // ดึงข้อมูลรายวิชาและ Section (สไตล์ภาพ 2)
    function fetchDropdownData() {
        const subSel = document.getElementById('subjectSelect');
        const secSel = document.getElementById('sectionSelect');
        subSel.innerHTML = '<option value="">เลือกวิชา</option>';

        db.ref('subjects').once('value').then(snap => {
            const data = snap.val();
            if (!data) {
                subSel.innerHTML = '<option value="">ไม่พบข้อมูลรายวิชา</option>'; return;
            }
            subSel.innerHTML = '<option value="">เลือกวิชา</option>';
            for (let k in data) {
                let opt = document.createElement('option');
                opt.value = k; opt.textContent = k;
                subSel.appendChild(opt);
            }

            subSel.onchange = function() {
                secSel.innerHTML = '<option value="">เลือก Section</option>';
                if (data[this.value] && data[this.value].sections) {
                    data[this.value].sections.forEach(s => {
                        let o = document.createElement('option');
                        o.value = s; o.textContent = s;
                        secSel.appendChild(o);
                    });
                }
            };
        }).catch(err => {
            console.error(err);
            subSel.innerHTML = '<option value="">เกิดข้อผิดพลาดในการโหลด</option>';
        });
    }

    // จัดการ Modal
    document.getElementById("moreInfoBtn").onclick = () => modal.style.display = "flex";
    document.querySelector(".close-modal").onclick = () => modal.style.display = "none";
    window.onclick = (e) => { if (e.target == modal) modal.style.display = "none"; }

    // ══════════════════════════════════════════
    // 9. FINAL SUBMIT (CREATE LAB) - ตรวจสอบข้อมูล
    // ══════════════════════════════════════════
    // ค้นหาปุ่ม submitBtn ใน Test.js แล้ววางทับด้วยโค้ดนี้
document.getElementById('submitBtn').addEventListener('click', function() {
    const labName = document.getElementById('labName').value.trim();
    const subject = document.getElementById('subjectSelect').value;
    const section = document.getElementById('sectionSelect').value;
    const description = document.getElementById('description').value;

    // --- 1. Validation ---
    if (!labName || !subject || !section) {
        return alert('กรุณากรอกข้อมูล ชื่อ Lab, วิชา และ Section ให้ครบถ้วน');
    }

    // ตรวจ Weight รวมของทุกรูปต้องเป็น 100%
    for (let img of appState.images) {
        const totalW = calculateTotalWeight(img.id);
        if (totalW !== 100) {
            alert(`รูปที่ ${getImageIndex(img.id)} มี Weight รวม ${totalW}% (ต้องครบ 100%)`);
            switchTab(img.id);
            return;
        }
    }

    // --- 2. Prepare Data Object ---
    const finalData = {
        labInfo: {
            name: labName,
            subject: subject,
            section: section,
            description: description,
            timestamp: new Date().toLocaleString()
        },
        // เก็บข้อมูลรูปภาพและกฎของรูปนั้นๆ
        details: appState.images.map(img => ({
            id: img.id,
            preview: img.preview, // ข้อมูลรูปภาพ (Base64)
            passThreshold: img.passThreshold,
            useMandatory: img.useMandatory,
            rules: appState.rules[img.id] || []
        }))
    };

    // --- 3. Save to LocalStorage ---
    try {
        localStorage.setItem('labConfigData', JSON.stringify(finalData));
        
        // แสดง Feedback เล็กน้อยก่อนไป
        this.innerText = "กำลังบันทึก...";
        this.style.backgroundColor = "#2ECC71";

        setTimeout(() => {
            window.location.href = 'taViewsubmission_PAGE.html';
        }, 1000);
    } catch (e) {
        console.error("Storage Error:", e);
        alert("ข้อมูลมีขนาดใหญ่เกินไป (อาจเพราะรูปภาพ) กรุณาลดขนาดรูปภาพลง");
    }

    // เตรียมข้อมูลที่จะส่ง
const labData = {
    name: document.getElementById('labName').value,
    subject: document.getElementById('subjectSelect').value,
    section: document.getElementById('sectionSelect').value,
    images: appState.images, // ส่งข้อมูลรูปภาพทั้งหมด
    rules: appState.rules    // ส่งกฎ AI ทั้งหมด
};

// บันทึกชั่วคราวลง Browser
localStorage.setItem('currentLab', JSON.stringify(labData));

// ย้ายหน้าไป taView
window.location.href = 'taView.html';
});

    

    // ══════════════════════════════════════════
    // INIT (เริ่มต้นทำงาน)
    // ══════════════════════════════════════════
    fetchDropdownData(); // โหลด Database
    renderTabs();         // โหลดแท็บ
    updateUploadZone();   // อัปเดตพื้นที่อัปโหลด
    renderRules();        // โหลดรายการกฎ
    renderWeightSummary(); // โหลดบล็อกสรุป
});