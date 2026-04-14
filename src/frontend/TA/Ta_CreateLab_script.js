//  API CONFIG  — เปลี่ยน BASE_URL ให้ตรงกับ API Gateway 
const API_BASE = 'https://YOUR_API_GATEWAY_URL';
 
//  SLOT STATE
const slotStates = {};
let activeSlot = 1;
let slotCount   = 2;
 
function defaultState() {
  return { rules: [], minScore: 75, mustPass: false, image: null };
}
 
function captureState(idx) {
  const rules = [];
  document.querySelectorAll('#rulesBody tr').forEach(tr => {
    const kwInput  = tr.querySelector('.keyword input');
    const kwText   = tr.querySelector('.keyword');
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
    minScore : Number(document.getElementById('minScoreVal')?.value || 75),
    mustPass : document.getElementById('mustPass')?.checked || false,
    image    : slotStates[idx]?.image || null
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
  document.getElementById('minScoreVal').value  = state.minScore;
  document.getElementById('mustPass').checked   = state.mustPass;
  document.getElementById('keyRulesLabel').textContent = `for Image ${idx}`;
  updateWeight();
  renderImage(state.image);
}
 
function renderImage(src) {
  const uploadZone  = document.getElementById('uploadZone');
  const previewWrap = document.getElementById('imgPreviewWrap');
  const previewImg  = document.getElementById('imgPreview');
  if (src) {
    previewImg.src              = src;
    uploadZone.style.display    = 'none';
    previewWrap.style.display   = 'block';
  } else {
    uploadZone.style.display    = '';
    previewWrap.style.display   = 'none';
    previewImg.src              = '';
  }
}
 
function buildRowHTML(rule) {
  const tolHTML = rule.textPos
    ? `<select class="tol-select">
         <option${rule.tolerance === 'Med (±15%)' ? ' selected' : ''}>Med (±15%)</option>
         <option${rule.tolerance === 'Low (±5%)'  ? ' selected' : ''}>Low (±5%)</option>
         <option${rule.tolerance === 'High (±25%)'? ' selected' : ''}>High (±25%)</option>
       </select>`
    : `<span class="na-text">N/A</span>`;
  return `
    <td class="keyword">
      <input type="text" value="${rule.keyword}"
        placeholder="Enter keyword..."
        style="width:100%;border:none;background:transparent;outline:none;
               font-family:monospace;font-size:12.5px;color:#0f172a;"/>
    </td>
    <td class="weight-cell">
      <div class="weight-input-wrap">
        <input type="number" value="${rule.weight}" min="0" max="100"/>
        <span>%</span>
      </div>
    </td>
    <td class="pos-cell">
      <label class="toggle">
        <input type="checkbox"${rule.textPos ? ' checked' : ''}/>
        <span class="slider"></span>
      </label>
    </td>
    <td class="tol-cell">${tolHTML}</td>
    <td class="mand-cell">
      <label class="toggle mandatory">
        <input type="checkbox"${rule.mandatory ? ' checked' : ''}/>
        <span class="slider"></span>
      </label>
    </td>
  `;
}
 
function bindRow(tr) {
  tr.querySelectorAll('input[type="number"]').forEach(i =>
    i.addEventListener('input', updateWeight)
  );
  tr.querySelector('.pos-cell input[type="checkbox"]').addEventListener('change', function () {
    const tolCell = tr.querySelector('.tol-cell');
    tolCell.innerHTML = this.checked
      ? `<select class="tol-select">
           <option>Med (±15%)</option>
           <option>Low (±5%)</option>
           <option>High (±25%)</option>
         </select>`
      : `<span class="na-text">N/A</span>`;
  });
}
 
function updateWeight() {
  let total = 0;
  document.querySelectorAll('#rulesBody input[type="number"]').forEach(i =>
    total += Number(i.value) || 0
  );
  const pct   = Math.min(total, 100);
  const color = total === 100 ? '#059669' : '#D97706';
  document.getElementById('weightVal').textContent       = `${total} / 100%`;
  document.getElementById('weightVal').style.color       = color;
  document.getElementById('progressFill').style.width    = `${pct}%`;
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
 
// ── Re-index tabs after delete ──
function reindexTabs() {
  const tabs = document.querySelectorAll('.tab-btn:not(.tab-add)');
  const newSlotStates = {};
 
  tabs.forEach((tab, index) => {
    const oldId = tab.dataset.slot;
    const newId = index + 1;
 
    tab.innerHTML = `
      <i class="ph ph-image"></i> Image ${newId}
      <span class="btn-close-tab"><i class="ph ph-x"></i></span>
    `;
    tab.dataset.slot = newId;
 
    newSlotStates[newId] = slotStates[oldId] || defaultState();
    if (activeSlot == oldId) activeSlot = newId;
  });
 
  Object.keys(slotStates).forEach(k => delete slotStates[k]);
  Object.assign(slotStates, newSlotStates);
  document.getElementById('keyRulesLabel').textContent = `for Image ${activeSlot}`;
}
 
//  INIT  — อ่าน slot 1 จาก static HTML แล้วแปลงเป็น state
(function () {
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
 
//  TAB EVENTS
document.getElementById('tabBar').addEventListener('click', e => {
  // ── ลบ slot ──
  const closeBtn = e.target.closest('.btn-close-tab');
  if (closeBtn) {
    e.stopPropagation();
    const allTabs = document.querySelectorAll('.tab-btn:not(.tab-add)');
    if (allTabs.length <= 1) {
      showToast('ต้องมีอย่างน้อย 1 Image', 'error');
      return;
    }
    closeBtn.closest('.tab-btn').remove();
    reindexTabs();
    renderState(activeSlot);
    return;
  }
 
  const btn = e.target.closest('.tab-btn');
  if (!btn) return;
 
  // ── เพิ่ม slot ──
  if (btn.id === 'addSlotBtn') {
    captureState(activeSlot);
    const currentCount = document.querySelectorAll('.tab-btn:not(.tab-add)').length;
    const newId = currentCount + 1;
    const newBtn = document.createElement('button');
    newBtn.className    = 'tab-btn';
    newBtn.dataset.slot = newId;
    newBtn.innerHTML    = `
      <i class="ph ph-image"></i> Image ${newId}
      <span class="btn-close-tab"><i class="ph ph-x"></i></span>
    `;
    document.getElementById('addSlotBtn').before(newBtn);
    slotStates[newId] = defaultState();
    reindexTabs();
    switchTab(newId);
    return;
  }
 
  // ── สลับ tab ──
  switchTab(Number(btn.dataset.slot));
});
 

//  IMAGE UPLOAD / REMOVE
document.getElementById('fileInput').addEventListener('change', function () {
  const file = this.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    slotStates[activeSlot].image = e.target.result;
    renderImage(e.target.result);
  };
  reader.readAsDataURL(file);
  this.value = '';
});
 
document.getElementById('uploadZone').addEventListener('click', () =>
  document.getElementById('fileInput').click()
);
 
const rmBtn = document.getElementById('removeImgBtn');
rmBtn.addEventListener('click', e => {
  e.stopPropagation();
  slotStates[activeSlot].image = null;
  renderImage(null);
});
rmBtn.addEventListener('mouseenter', () => rmBtn.style.background = 'rgba(225,29,72,.85)');
rmBtn.addEventListener('mouseleave', () => rmBtn.style.background = 'rgba(15,23,42,.65)');
 
//  ADD RULE
document.getElementById('addRuleBtn').addEventListener('click', () => {
  const tr = document.createElement('tr');
  tr.innerHTML = buildRowHTML({ keyword: '', weight: 0, textPos: false, tolerance: 'N/A', mandatory: false });
  document.getElementById('rulesBody').appendChild(tr);
  bindRow(tr);
  updateWeight();
});
 

//  TAG TOGGLE
function toggleTag(el) {
  el.classList.toggle('selected');
}
 

//  TOAST
function showToast(msg, type = 'success') {
  let toast = document.getElementById('vm-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'vm-toast';
    toast.style.cssText = `
      position:fixed;bottom:28px;right:28px;
      padding:14px 20px;border-radius:10px;
      font-family:'Inter',sans-serif;
      font-size:13.5px;font-weight:600;color:#fff;
      box-shadow:0 4px 20px rgba(0,0,0,.18);
      display:none;align-items:center;gap:10px;
      z-index:9999;transition:opacity .3s;
    `;
    document.body.appendChild(toast);
  }
  toast.style.background = type === 'success' ? '#059669' : '#E11D48';
  toast.innerHTML = `
    <i class="ph ${type === 'success' ? 'ph-check-circle' : 'ph-x-circle'}"
       style="font-size:18px;"></i>
    <span>${msg}</span>
  `;
  toast.style.display = 'flex';
  toast.style.opacity = '1';
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => { toast.style.display = 'none'; }, 300);
  }, 3500);
}
 

//  VALIDATE
function validateForm() {
  const labNameInput = document.querySelector('input[placeholder="e.g., Lab 03: CPU Registers"]');
  if (!labNameInput?.value.trim())
    return 'กรุณากรอก Lab Name';
 
  const selectedClasses = document.querySelectorAll('.tag-list .tag.selected');
  if (selectedClasses.length === 0)
    return 'กรุณาเลือก Class อย่างน้อย 1 วิชา';
 
  const dueDateInput = document.querySelector('input[type="date"]');
  if (!dueDateInput?.value)
    return 'กรุณาเลือก Due Date';
 
  return null;
}
 

//  CREATE LAB  →  POST /lab-config
async function handleCreateLab() {
  const validationError = validateForm();
  if (validationError) {
    showToast(validationError, 'error');
    return;
  }
 
  // บันทึก slot ปัจจุบันก่อน
  captureState(activeSlot);
 
  // ── ดึงค่าจาก form ──
  const labName    = document.querySelector('input[placeholder="e.g., Lab 03: CPU Registers"]').value.trim();
  const dueDate    = document.querySelector('input[type="date"]').value;
  const dueTime    = document.querySelector('input[type="time"]').value || '00:00';
  const description = document.querySelector('textarea').value.trim();
  const deadline   = `${dueDate}T${dueTime}:00.000Z`;
 
  // ── Classes & Sections ──
  const tagLists = document.querySelectorAll('.tag-list');
  const selectedClasses  = [...(tagLists[0]?.querySelectorAll('.tag.selected') || [])]
    .map(t => t.textContent.trim());
  const selectedSections = [...(tagLists[1]?.querySelectorAll('.tag.selected') || [])]
    .map(t => t.textContent.trim());
 
  // ── Rules ต่อ slot ──
  const rules = Object.entries(slotStates).map(([slot, state]) => ({
    imageSlot : Number(slot),
    keywords  : state.rules.map(r => ({
      keyword   : r.keyword,
      weight    : r.weight,
      textPos   : r.textPos,
      tolerance : r.tolerance,
      mandatory : r.mandatory
    }))
  }));
 
  // ── Images (เฉพาะ slot ที่มีรูป) ──
  const images = Object.entries(slotStates)
    .filter(([, state]) => state.image)
    .map(([slot, state]) => ({ slot: Number(slot), data: state.image }));
 
  // ── Thresholds ──
  const thresholds = {
    minScore          : Number(document.getElementById('minScoreVal')?.value || 75),
    mustPassMandatory : document.getElementById('mustPass')?.checked || false
  };
 
  // ── Payload ──
  const payload = {
    labName,
    subjectId   : selectedClasses[0] || '',
    sections    : selectedSections,
    description,
    deadline,
    images,
    rules,
    thresholds,
    createdBy   : 'TA'
  };
 
  // ── Loading state ──
  const btn = document.getElementById('createLabBtn');
  btn.disabled = true;
  btn.innerHTML = '<i class="ph ph-circle-notch" style="animation:spin .8s linear infinite;"></i> Creating...';
 
  try {
    const res  = await fetch(`${API_BASE}/lab-config`, {
      method  : 'POST',
      headers : { 'Content-Type': 'application/json' },
      body    : JSON.stringify(payload)
    });
 
    const data = await res.json();
 
    if (data.success) {
      showToast(`✓ สร้าง Lab "${labName}" สำเร็จ! (ID: ${data.labID})`, 'success');
      // uncomment เพื่อ redirect หลังสำเร็จ:
      // setTimeout(() => window.location.href = 'Ta_Dashboard.html', 1800);
    } else {
      showToast(`Error: ${data.error || 'Unknown error'}`, 'error');
    }
  } catch (err) {
    showToast(`Network error: ${err.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="ph ph-plus-circle"></i> Create Lab';
  }
}
 
// ── Spin keyframe ──
const _style = document.createElement('style');
_style.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
document.head.appendChild(_style);