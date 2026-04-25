//  API CONFIG  — เปลี่ยน BASE_URL ให้ตรงกับ API Gateway
const API_BASE = 'https://YOUR_API_GATEWAY_URL';
//  ใช้ mock เมื่อ API_BASE ยังเป็น placeholder (โหมด dev)
const USE_MOCK_API = API_BASE.includes('YOUR_API_GATEWAY_URL');
 
//  SLOT STATE
const slotStates = {};
let activeSlot = 1;
 
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
    const mandatory = tr.querySelector('.mand-cell input[type="checkbox"]')?.checked || false;
    rules.push({ keyword, weight, mandatory });
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
  updateWeight();
  renderSlotSelector();
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
  return `
    <td class="keyword">
      <input type="text" value="${rule.keyword.replace(/"/g,'&quot;')}"  
        placeholder="Enter keyword..."
        style="width:100%;border:none;background:transparent;outline:none;
               font-family:monospace;font-size:12.5px;color:#0f172a;"/>
    </td>
    <td class="weight-cell text-center">
      <div class="weight-input-wrap">
        <input type="number" value="${rule.weight}" min="0" max="100"/>
        <span>%</span>
      </div>
    </td>
    <td class="mand-cell text-center">
      <label class="toggle mandatory">
        <input type="checkbox"${rule.mandatory ? ' checked' : ''}/>
        <span class="slider"></span>
      </label>
    </td>
    <td class="del-cell text-center">
      <button type="button" class="del-rule-btn"
        style="background:none;border:none;cursor:pointer;color:#94A3B8;padding:4px 6px;border-radius:6px;transition:color .15s,background .15s;"
        onmouseenter="this.style.color='#E11D48';this.style.background='#FFF1F2'"
        onmouseleave="this.style.color='#94A3B8';this.style.background='none'">
        <i class="ph ph-trash" style="font-size:15px;pointer-events:none;"></i>
      </button>
    </td>
  `;
}
 
function bindRow(tr) {
  tr.querySelectorAll('input[type="number"]').forEach(i =>
    i.addEventListener('input', updateWeight)
  );
  tr.querySelector('.keyword input')?.addEventListener('input', updateSetupProgress);
  tr.querySelector('.del-rule-btn')?.addEventListener('click', () => {
    tr.remove();
    distributeWeight();
  });
}
 
function renderSlotSelector() {
  const container = document.getElementById('slotSelector');
  if (!container) return;
  container.innerHTML = '';
  document.querySelectorAll('.tab-btn:not(.tab-add)').forEach(tab => {
    const id = Number(tab.dataset.slot);
    const isActive = id === activeSlot;
    const pill = document.createElement('button');
    pill.type = 'button';
    pill.textContent = `Image ${id}`;
    pill.className = isActive
      ? 'text-p2 font-semibold text-white bg-brand-500 border border-brand-500 rounded-full px-2.5 py-0.5 transition-colors'
      : 'text-p2 font-semibold text-gray-500 bg-transparent border border-layout-border rounded-full px-2.5 py-0.5 hover:border-brand-500 hover:text-brand-500 transition-colors';
    pill.addEventListener('click', () => switchTab(id));
    container.appendChild(pill);
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
  updateSetupProgress();
}
 
function distributeWeight() {
  const inputs = [...document.querySelectorAll('#rulesBody input[type="number"]')];
  if (inputs.length === 0) { updateWeight(); return; }
  const base = Math.floor(100 / inputs.length);
  const remainder = 100 - base * inputs.length;
  inputs.forEach((inp, i) => {
    inp.value = i === inputs.length - 1 ? base + remainder : base;
  });
  updateWeight();
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
  renderSlotSelector();
}
 
//  INIT  — อ่าน slot 1 จาก static HTML แล้วแปลงเป็น state
(function () {
  const rules = [];
  document.querySelectorAll('#rulesBody tr').forEach(tr => {
    const kw  = tr.querySelector('.keyword')?.textContent.trim() || '';
    const w   = Number(tr.querySelector('.weight-cell input')?.value || 0);
    const man = tr.querySelector('.mand-cell input')?.checked || false;
    rules.push({ keyword: kw, weight: w, mandatory: man });
  });
  slotStates[1] = { rules, minScore: 75, mustPass: false, image: null };
  document.querySelectorAll('#rulesBody tr').forEach(tr => bindRow(tr));
  updateWeight();
  renderState(1);
  document.querySelector('input[placeholder="e.g., Lab 03: CPU Registers"]')
    ?.addEventListener('input', updateSetupProgress);
  document.querySelector('input[type="date"]')
    ?.addEventListener('change', updateSetupProgress);
})();
 
function updateSetupProgress() {
  const steps = [
    { key: 'Lab Name', done: !!document.querySelector('input[placeholder="e.g., Lab 03: CPU Registers"]')?.value.trim() },
    { key: 'Class',    done: (document.querySelectorAll('.tag-list')[0]?.querySelectorAll('.tag.selected').length || 0) > 0 },
    { key: 'Section',  done: (document.querySelectorAll('.tag-list')[1]?.querySelectorAll('.tag.selected').length || 0) > 0 },
    { key: 'Due Date', done: !!document.querySelector('input[type="date"]')?.value },
    { key: 'Image',    done: Object.keys(slotStates).map(Number).every(id => slotStates[id].image) },
    { key: 'Keywords', done: (() => {
      const activeInputs = [...document.querySelectorAll('#rulesBody .keyword input')];
      if (activeInputs.length === 0) return false;
      if (!activeInputs.every(inp => inp.value.trim() !== '')) return false;
      return Object.keys(slotStates).map(Number).every(id => {
        if (id === activeSlot) return true;
        return slotStates[id].rules.length > 0 && slotStates[id].rules.every(r => r.keyword.trim() !== '');
      });
    })() },
    { key: 'Weight',   done: (() => {
      let activeTotal = 0;
      document.querySelectorAll('#rulesBody input[type="number"]').forEach(i => activeTotal += Number(i.value)||0);
      return Object.keys(slotStates).map(Number).every(id => {
        if (id === activeSlot) return activeTotal === 100;
        return slotStates[id].rules.reduce((s, r) => s + (r.weight || 0), 0) === 100;
      });
    })() },
  ];
  const done  = steps.filter(s => s.done).length;
  const pct   = Math.round((done / steps.length) * 100);
  const color = pct === 100 ? '#059669' : '#4F46E5';

  const bar    = document.getElementById('setupBar');
  const pctEl  = document.getElementById('setupPct');
  const stepsEl = document.getElementById('setupSteps');
  if (bar)    { bar.style.width = `${pct}%`; bar.style.background = color; }
  if (pctEl)  { pctEl.textContent = `${pct}%`; pctEl.style.color = color; }
  if (stepsEl) {
    stepsEl.innerHTML = steps.map(s =>
      `<span style="display:inline-flex;align-items:center;gap:3px;font-size:11px;font-weight:700;color:${s.done ? '#10B981' : '#94A3B8'}">`+
      `<i class="ph-fill ${s.done ? 'ph-check-circle' : 'ph-circle'}" style="font-size:12px;"></i>${s.key}</span>`
    ).join('');
  }
}
 
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
    const tabToRemove   = closeBtn.closest('.tab-btn');
    const removedSlotId = Number(tabToRemove.dataset.slot);
    const wasActive     = removedSlotId === activeSlot;

    // pick fallback neighbor BEFORE removing (prev sibling if exists, else next)
    let fallbackTab = tabToRemove.previousElementSibling;
    if (!fallbackTab || fallbackTab.classList.contains('tab-add')) {
      fallbackTab = tabToRemove.nextElementSibling;
    }
    if (fallbackTab && fallbackTab.classList.contains('tab-add')) fallbackTab = null;

    // drop the removed slot's state BEFORE reindex so it doesn't get carried over
    delete slotStates[removedSlotId];
    tabToRemove.remove();

    if (wasActive && fallbackTab) {
      // set activeSlot to fallback's OLD id so reindex maps it correctly
      activeSlot = Number(fallbackTab.dataset.slot);
    }

    reindexTabs();

    // ensure exactly one tab has .active class matching activeSlot
    document.querySelectorAll('.tab-btn:not(.tab-add)').forEach(b =>
      b.classList.toggle('active', Number(b.dataset.slot) === activeSlot)
    );
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
    updateSetupProgress();
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
  updateSetupProgress();
});
rmBtn.addEventListener('mouseenter', () => rmBtn.style.background = 'rgba(225,29,72,.85)');
rmBtn.addEventListener('mouseleave', () => rmBtn.style.background = 'rgba(15,23,42,.65)');

//  ADD RULE
document.getElementById('addRuleBtn').addEventListener('click', () => {
  const tr = document.createElement('tr');
  tr.innerHTML = buildRowHTML({ keyword: '', weight: 0, mandatory: false });
  document.getElementById('rulesBody').appendChild(tr);
  bindRow(tr);
  distributeWeight();
});
 

//  TAG TOGGLE
function toggleTag(el) {
  el.classList.toggle('selected');
  updateSetupProgress();
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
  if (!document.querySelector('input[placeholder="e.g., Lab 03: CPU Registers"]')?.value.trim())
    return 'กรุณากรอก Lab Name';

  if ((document.querySelectorAll('.tag-list')[0]?.querySelectorAll('.tag.selected').length || 0) === 0)
    return 'กรุณาเลือก Class อย่างน้อย 1 วิชา';

  if ((document.querySelectorAll('.tag-list')[1]?.querySelectorAll('.tag.selected').length || 0) === 0)
    return 'กรุณาเลือก Section อย่างน้อย 1 ห้อง';

  if (!document.querySelector('input[type="date"]')?.value)
    return 'กรุณาเลือก Due Date';

  const slotIds = Object.keys(slotStates).map(Number);

  for (const id of slotIds) {
    const label = `Image ${id}`;
    if (!slotStates[id].image)
      return `กรุณาอัพโหลดรูป ${label}`;
    if (slotStates[id].rules.length === 0)
      return `กรุณาเพิ่ม Key Rule สำหรับ ${label}`;
    if (slotStates[id].rules.some(r => !r.keyword.trim()))
      return `กรุณาใส่ Keyword ให้ครบทุก Rule ใน ${label}`;
    const totalW = slotStates[id].rules.reduce((s, r) => s + (r.weight || 0), 0);
    if (totalW !== 100)
      return `Weight รวมของ ${label} ต้องเท่ากับ 100% (ปัจจุบัน ${totalW}%)`;
  }

  return null;
}
 

//  CREATE LAB  →  POST /lab-config
async function handleCreateLab() {
  captureState(activeSlot);
  const validationError = validateForm();
  if (validationError) {
    showToast(validationError, 'error');
    return;
  }
 
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
    let data;
    if (USE_MOCK_API) {
      // ── MOCK: simulate network delay then succeed ──
      await new Promise(r => setTimeout(r, 900));
      const mockId = 'LAB-' + Date.now().toString(36).toUpperCase();
      data = { success: true, labID: mockId };
      console.info('[MOCK handleCreateLab] payload:', payload);
    } else {
      const res = await fetch(`${API_BASE}/lab-config`, {
        method  : 'POST',
        headers : { 'Content-Type': 'application/json' },
        body    : JSON.stringify(payload)
      });
      data = await res.json();
    }

    if (data.success) {
      showToast(`✓ สร้าง Lab "${labName}" สำเร็จ! (ID: ${data.labID})`, 'success');
      setTimeout(() => window.location.href = 'Ta_Dashboard.html', 1500);
    } else {
      showToast(`Error: ${data.error || 'Unknown error'}`, 'error');
    }
  } catch (err) {
    showToast(`Network error: ${err.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="ph-bold ph-check-circle text-sm"></i> Create Lab';
  }
}
 
// ── Spin keyframe ──
const _style = document.createElement('style');
_style.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
document.head.appendChild(_style);

// ════════════════════════════════════════════════════════════
//  EDIT MODE — prefill form when ?mode=edit&lab=<id>
//  Mock data keyed by lab id (matches TaViewSubmission LABS map)
// ════════════════════════════════════════════════════════════
const MOCK_LAB_DETAILS = {
  201: { name: 'Lab 01 - CPU Registers',     subject: 'CS232', sections: ['1001'],         due: '2026-04-10', time: '23:59', desc: 'Configure registers in Verilog.' },
  202: { name: 'Lab 02 - Pipelining',        subject: 'CS232', sections: ['1001'],         due: '2026-04-17', time: '23:59', desc: 'Implement 5-stage pipeline.' },
  203: { name: 'Lab 03 - Cache Memory',      subject: 'CS232', sections: ['1002'],         due: '2026-04-24', time: '23:59', desc: 'Direct-mapped cache simulation.' },
  301: { name: 'Lab 01 - Linked List',       subject: 'CS232', sections: ['1001', '1002'], due: '2026-04-12', time: '23:59', desc: 'Doubly linked list operations.' },
  302: { name: 'Lab 02 - Binary Tree',       subject: 'CS232', sections: ['1001'],         due: '2026-04-19', time: '23:59', desc: 'BST insert/delete/search.' },
  401: { name: 'Lab 01 - Process Scheduling',subject: 'CS232', sections: ['1001'],         due: '2026-04-05', time: '23:59', desc: 'Round-robin scheduler.' },
  402: { name: 'Lab 02 - Threads & Mutex',   subject: 'CS232', sections: ['1002'],         due: '2026-04-12', time: '23:59', desc: 'Mutex-protected counter.' },
};

(function applyEditMode() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('mode') !== 'edit') return;
  const labId = params.get('lab');
  const data = MOCK_LAB_DETAILS[labId];
  if (!data) return;

  // Header / breadcrumb
  document.title = `ValidMate - Edit ${data.name}`;
  const headerTitle = document.querySelector('h1.text-h3');
  if (headerTitle) headerTitle.textContent = 'Edit Lab';
  const headerSub = headerTitle?.nextElementSibling;
  if (headerSub) headerSub.textContent = `Update details for ${data.name}`;
  const breadcrumb = document.querySelector('.text-brand-800 .ph-file-code')?.parentElement;
  if (breadcrumb) breadcrumb.lastChild.textContent = ' Edit Lab';

  // Lab Name
  const nameInput = document.querySelector('input[placeholder="e.g., Lab 03: CPU Registers"]');
  if (nameInput) nameInput.value = data.name;

  // Class tags — select matching subject
  document.querySelectorAll('.tag-list')[0]?.querySelectorAll('.tag').forEach(t => {
    if (t.textContent.trim() === data.subject) t.classList.add('selected');
    else t.classList.remove('selected');
  });

  // Section tags
  document.querySelectorAll('.tag-list')[1]?.querySelectorAll('.tag').forEach(t => {
    if (data.sections.includes(t.textContent.trim())) t.classList.add('selected');
    else t.classList.remove('selected');
  });

  // Due date / time
  const dateEl = document.querySelector('input[type="date"]');
  if (dateEl) dateEl.value = data.due;
  const timeEl = document.querySelector('input[type="time"]');
  if (timeEl) timeEl.value = data.time;

  // Description
  const descEl = document.querySelector('textarea');
  if (descEl) descEl.value = data.desc;

  // Update Create button → Update Lab
  const createBtn = document.getElementById('createLabBtn');
  if (createBtn) createBtn.innerHTML = '<i class="ph-bold ph-floppy-disk text-sm"></i> Update Lab';

  updateSetupProgress();
})();