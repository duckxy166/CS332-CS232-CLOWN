  // ── Slot state ──
  const slotStates = {};
  let activeSlot = 1;
  let slotCount = 2;
 
  function defaultState() {
    return { rules: [], minScore: 75, mustPass: false, image: null };
  }
 
  function captureState(idx) {
    const rules = [];
    document.querySelectorAll('#rulesBody tr').forEach(tr => {
      const kwInput = tr.querySelector('.keyword input');
      const kwText  = tr.querySelector('.keyword');
      const keyword  = kwInput ? kwInput.value : (kwText ? kwText.textContent.trim() : '');
      const weight   = Number(tr.querySelector('.weight-cell input[type="number"]')?.value || 0);
      const textPos  = tr.querySelector('.pos-cell input[type="checkbox"]')?.checked || false;
      const tolSel   = tr.querySelector('.tol-cell select');
      const tolerance = tolSel ? tolSel.value : 'N/A';
      const mandatory = tr.querySelector('.mand-cell input[type="checkbox"]')?.checked || false;
      rules.push({ keyword, weight, textPos, tolerance, mandatory });
    });
    slotStates[idx] = {
      rules,
      minScore: Number(document.getElementById('minScoreVal')?.value || 75),
      mustPass: document.getElementById('mustPass')?.checked || false,
      image: slotStates[idx]?.image || null
    };
  }
 
  function renderState(idx) {
    const state = slotStates[idx] || defaultState();
    const tbody = document.getElementById('rulesBody');
    tbody.innerHTML = '';
    state.rules.forEach(rule => {
      const tr = document.createElement('tr');
      tr.innerHTML = buildRowHTML(rule);
      tbody.appendChild(tr);
      bindRow(tr);
    });
    document.getElementById('minScoreVal').value = state.minScore;
    document.getElementById('mustPass').checked  = state.mustPass;
    document.getElementById('keyRulesLabel').textContent = `for Image ${idx}`;
    updateWeight();
    // restore image
    renderImage(state.image);
  }
 
  function renderImage(src) {
    const uploadZone    = document.getElementById('uploadZone');
    const previewWrap   = document.getElementById('imgPreviewWrap');
    const previewImg    = document.getElementById('imgPreview');
    if (src) {
      previewImg.src = src;
      uploadZone.style.display   = 'none';
      previewWrap.style.display  = 'block';
    } else {
      uploadZone.style.display   = '';
      previewWrap.style.display  = 'none';
      previewImg.src = '';
    }
  }
 
  function buildRowHTML(rule) {
    const tolHTML = rule.textPos
      ? `<select class="tol-select">
           <option${rule.tolerance==='Med (±15%)'?' selected':''}>Med (±15%)</option>
           <option${rule.tolerance==='Low (±5%)'?' selected':''}>Low (±5%)</option>
           <option${rule.tolerance==='High (±25%)'?' selected':''}>High (±25%)</option>
         </select>`
      : `<span class="na-text">N/A</span>`;
    return `
      <td class="keyword"><input type="text" value="${rule.keyword}" placeholder="Enter keyword..." style="width:100%;border:none;background:transparent;outline:none;font-family:monospace;font-size:12.5px;color:#0f172a;"/></td>
      <td class="weight-cell"><div class="weight-input-wrap"><input type="number" value="${rule.weight}" min="0" max="100"/><span>%</span></div></td>
      <td class="pos-cell"><label class="toggle"><input type="checkbox"${rule.textPos?' checked':''}/><span class="slider"></span></label></td>
      <td class="tol-cell">${tolHTML}</td>
      <td class="mand-cell"><label class="toggle mandatory"><input type="checkbox"${rule.mandatory?' checked':''}/><span class="slider"></span></label></td>
    `;
  }
 
  function bindRow(tr) {
    tr.querySelectorAll('input[type="number"]').forEach(i => i.addEventListener('input', updateWeight));
    tr.querySelector('.pos-cell input[type="checkbox"]').addEventListener('change', function() {
      const tolCell = tr.querySelector('.tol-cell');
      tolCell.innerHTML = this.checked
        ? `<select class="tol-select"><option>Med (±15%)</option><option>Low (±5%)</option><option>High (±25%)</option></select>`
        : `<span class="na-text">N/A</span>`;
    });
  }
 
  function updateWeight() {
    let total = 0;
    document.querySelectorAll('#rulesBody input[type="number"]').forEach(i => total += Number(i.value) || 0);
    const pct = Math.min(total, 100);
    document.getElementById('weightVal').textContent = total + ' / 100%';
    document.getElementById('progressFill').style.width = pct + '%';
    const color = total === 100 ? '#059669' : '#D97706';
    document.getElementById('weightVal').style.color = color;
    document.getElementById('progressFill').style.background = color;
  }
 
  function switchTab(idx) {
    captureState(activeSlot);
    activeSlot = idx;
    document.querySelectorAll('.tab-btn:not(.tab-add)').forEach(b =>
      b.classList.toggle('active', Number(b.dataset.slot) === idx)
    );
    renderState(idx);
  }
 
  // ── Init slot 1 from static HTML ──
  (function() {
    const rules = [];
    document.querySelectorAll('#rulesBody tr').forEach(tr => {
      const kw  = tr.querySelector('.keyword')?.textContent.trim() || '';
      const w   = Number(tr.querySelector('.weight-cell input')?.value || 0);
      const tp  = tr.querySelector('.pos-cell input')?.checked || false;
      const tol = tr.querySelector('.tol-cell select')?.value || 'N/A';
      const man = tr.querySelector('.mand-cell input')?.checked || false;
      rules.push({ keyword: kw, weight: w, textPos: tp, tolerance: tol, mandatory: man });
    });
    slotStates[1] = { rules, minScore: 75, mustPass: false, image: null };
    slotStates[2] = defaultState();
    document.querySelectorAll('#rulesBody tr').forEach(tr => bindRow(tr));
    updateWeight();
  })();
 
// ฟังก์ชันสำหรับเรียงเลข Image ใหม่ให้ถูกต้อง (Re-index)
function reindexTabs() {
  const tabs = document.querySelectorAll('.tab-btn:not(.tab-add)');
  const newSlotStates = {};
  
  tabs.forEach((tab, index) => {
    const oldId = tab.dataset.slot;
    const newId = index + 1; // เริ่มนับ 1 ใหม่เสมอ
    
    // อัปเดตข้อความในปุ่ม
    tab.innerHTML = `
      <i class="ph ph-image"></i> Image ${newId}
      <span class="btn-close-tab"><i class="ph ph-x"></i></span>
    `;
    
    // อัปเดต Dataset
    tab.dataset.slot = newId;
    
    // ย้ายข้อมูล State ไปยัง Key ใหม่
    if (slotStates[oldId]) {
      newSlotStates[newId] = slotStates[oldId];
    } else {
      newSlotStates[newId] = defaultState();
    }

    // ถ้าตัวนี้เคย active อยู่ ต้องอัปเดตค่า activeSlot ด้วย
    if (activeSlot == oldId) {
      activeSlot = newId;
    }
  });

  // แทนที่ state เก่าด้วย state ที่เรียงลำดับใหม่แล้ว
  Object.keys(slotStates).forEach(key => delete slotStates[key]);
  Object.assign(slotStates, newSlotStates);
  
  // อัปเดตหัวข้อ Rules ให้ตรงกับเลขใหม่
  document.getElementById('keyRulesLabel').textContent = `for Image ${activeSlot}`;
}

// แก้ไข Event Listener ของ tabBar
document.getElementById('tabBar').addEventListener('click', e => {
  const btn = e.target.closest('.tab-btn');
  const closeBtn = e.target.closest('.btn-close-tab');

  // --- กรณีลบ Tab ---
  if (closeBtn) {
    e.stopPropagation();
    const parentTab = closeBtn.closest('.tab-btn');
    const allTabs = document.querySelectorAll('.tab-btn:not(.tab-add)');
    
    if (allTabs.length <= 1) {
      alert("ต้องมีอย่างน้อย 1 Image");
      return;
    }

    parentTab.remove();
    reindexTabs(); // จัดลำดับเลขใหม่ทันทีที่ลบ
    renderState(activeSlot); // วาดตารางใหม่
    return;
  }

  if (!btn) return;

  // --- กรณีเพิ่ม Tab ---
  if (btn.id === 'addSlotBtn') {
    captureState(activeSlot);

    // สร้างปุ่มใหม่ (ชั่วคราวก่อน re-index)
    const newBtn = document.createElement('button');
    newBtn.className = 'tab-btn';
    // ใส่ลำดับต่อจากจำนวนที่มีอยู่ปัจจุบัน
    const currentTabCount = document.querySelectorAll('.tab-btn:not(.tab-add)').length;
    const newId = currentTabCount + 1;
    
    newBtn.dataset.slot = newId;
    newBtn.innerHTML = `
      <i class="ph ph-image"></i> Image ${newId}
      <span class="btn-close-tab"><i class="ph ph-x"></i></span>
    `;
    
    document.getElementById('addSlotBtn').before(newBtn);
    
    // รีเซ็ตลำดับและสร้าง State ใหม่
    slotStates[newId] = defaultState();
    reindexTabs();
    switchTab(newId);
  } else {
    switchTab(Number(btn.dataset.slot));
  }
});
 
  // ── File input: show preview ──
  document.getElementById('fileInput').addEventListener('change', function() {
    const file = this.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      slotStates[activeSlot].image = e.target.result;
      renderImage(e.target.result);
    };
    reader.readAsDataURL(file);
    this.value = ''; // reset so same file can be re-selected
  });
 
  // ── Upload zone click ──
  document.getElementById('uploadZone').addEventListener('click', () => {
    document.getElementById('fileInput').click();
  });
 
  // ── Remove image button ──
  document.getElementById('removeImgBtn').addEventListener('click', e => {
    e.stopPropagation();
    slotStates[activeSlot].image = null;
    renderImage(null);
  });
 
  // ── Remove btn hover style ──
  const rmBtn = document.getElementById('removeImgBtn');
  rmBtn.addEventListener('mouseenter', () => rmBtn.style.background = 'rgba(225,29,72,.85)');
  rmBtn.addEventListener('mouseleave', () => rmBtn.style.background = 'rgba(15,23,42,.65)');
 
  // ── Add Rule ──
  document.getElementById('addRuleBtn').addEventListener('click', () => {
    const tr = document.createElement('tr');
    tr.innerHTML = buildRowHTML({ keyword:'', weight:0, textPos:false, tolerance:'N/A', mandatory:false });
    document.getElementById('rulesBody').appendChild(tr);
    bindRow(tr);
    updateWeight();
  });
 
  // ── Tag toggle ──
  function toggleTag(el) {
    el.classList.toggle('selected');
  }