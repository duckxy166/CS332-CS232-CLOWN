// API config is centralized in api-config.js (API_BASE, API_ENDPOINTS, apiFetch).
let currentTaUser = null;

//  SLOT STATE
const slotStates = {};
let activeSlot = 1;

function defaultState() {
  return { rules: [], minScore: 75, mustPass: false, image: null, textractBlocks: null };
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
    image    : slotStates[idx]?.image || null,
    textractBlocks: slotStates[idx]?.textractBlocks || null
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
    <td class="verify-cell text-center">
      <button type="button" class="verify-btn" title="Run Textract on the reference image and check if this keyword exists">
        <i class="ph ph-magnifying-glass"></i>
        <span class="verify-label">Check</span>
      </button>
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
  const kwInput = tr.querySelector('.keyword input');
  kwInput?.addEventListener('input', updateSetupProgress);
  // Reset verify badge whenever the keyword changes — old verdict no longer applies.
  kwInput?.addEventListener('input', () => resetVerifyBtn(tr));
  tr.querySelector('.del-rule-btn')?.addEventListener('click', () => {
    tr.remove();
    distributeWeight();
  });
  tr.querySelector('.verify-btn')?.addEventListener('click', () => verifyRule(tr));
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
  slotStates[1] = { rules, minScore: 75, mustPass: false, image: null, textractBlocks: null };
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
    slotStates[activeSlot].textractBlocks = null; // invalidate any prior Textract cache
    resetAllVerifyBtns();
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
  slotStates[activeSlot].textractBlocks = null;
  resetAllVerifyBtns();
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


//  VERIFY KEYWORD against Textract output of the slot's reference image
function resetVerifyBtn(tr) {
  const btn = tr.querySelector('.verify-btn');
  if (!btn) return;
  btn.classList.remove('is-loading', 'is-found', 'is-missing');
  btn.disabled = false;
  btn.innerHTML = '<i class="ph ph-magnifying-glass"></i><span class="verify-label">Check</span>';
}

function resetAllVerifyBtns() {
  document.querySelectorAll('#rulesBody tr').forEach(resetVerifyBtn);
}

function inferImageType(dataUrl) {
  const m = /^data:([^;]+);base64,/.exec(String(dataUrl || ''));
  return m ? m[1] : 'image/png';
}

async function getOrFetchTextractBlocks(slotId) {
  const state = slotStates[slotId];
  if (!state) return null;
  if (Array.isArray(state.textractBlocks)) return state.textractBlocks;
  if (!state.image) {
    const err = new Error('Please upload a reference image for this slot first.');
    err.code = 'NO_IMAGE';
    throw err;
  }
  // /reference-upload requires a labID — use a temporary preview ID so the lambda
  // still uploads + Textracts, but the file lives in a "preview-..." key path.
  const previewLabId = `preview-${slotId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const data = await apiFetch(API_ENDPOINTS.referenceUpload, {
    method: 'POST',
    body: JSON.stringify({
      labID       : previewLabId,
      imageBase64 : stripDataUrl(state.image),
      imageType   : inferImageType(state.image),
    }),
  });
  if (!data?.success) throw new Error(data?.error || 'Reference upload failed');
  state.textractBlocks = Array.isArray(data.blocks) ? data.blocks : [];
  return state.textractBlocks;
}

async function verifyRule(tr) {
  const btn = tr.querySelector('.verify-btn');
  if (!btn) return;
  const kwInput = tr.querySelector('.keyword input');
  const keyword = (kwInput?.value || '').trim();
  if (!keyword) {
    showToast('กรุณากรอก Keyword ก่อนกด Verify', 'error');
    return;
  }
  if (!slotStates[activeSlot]?.image) {
    showToast(`กรุณาอัพโหลดรูป Image ${activeSlot} ก่อน`, 'error');
    return;
  }

  btn.classList.remove('is-found', 'is-missing');
  btn.classList.add('is-loading');
  btn.disabled = true;
  btn.innerHTML = '<i class="ph ph-circle-notch"></i><span class="verify-label">Checking…</span>';

  try {
    const blocks = await getOrFetchTextractBlocks(activeSlot);
    const needle = keyword.toLowerCase();
    const match  = (blocks || []).find(b => String(b.text || '').toLowerCase().includes(needle));

    btn.classList.remove('is-loading');
    btn.disabled = false;
    if (match) {
      btn.classList.add('is-found');
      btn.innerHTML = '<i class="ph-fill ph-check-circle"></i><span class="verify-label">Found</span>';
      showToast(`✓ "${keyword}" found in: "${match.text}"`, 'success');
    } else {
      btn.classList.add('is-missing');
      btn.innerHTML = '<i class="ph-fill ph-x-circle"></i><span class="verify-label">Not found</span>';
      showToast(`✗ Textract did not detect "${keyword}" in Image ${activeSlot}`, 'error');
    }
  } catch (err) {
    btn.classList.remove('is-loading');
    btn.disabled = false;
    btn.innerHTML = '<i class="ph ph-warning"></i><span class="verify-label">Retry</span>';
    btn.classList.add('is-missing');
    showToast(err.message || 'Verify failed', 'error');
  }
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
 
  // ── Flat rules array compatible with the checker engine (one entry per keyword) ──
  let ruleSeq = 0;
  const rules = Object.entries(slotStates).flatMap(([slot, state]) => {
    const imgId = Number(slot);
    return (state.rules || [])
      .filter(r => (r.keyword || '').trim().length)
      .map(r => ({
        id   : `r${++ruleSeq}`,
        imgId,
        kw   : r.keyword.trim(),
        wt   : Number(r.weight) || 0,
        mand : !!r.mandatory,
        pos  : false,
      }));
  });

  // ── Images: only slots with an uploaded reference (base64). ──
  const images = Object.entries(slotStates)
    .filter(([, state]) => state.image)
    .map(([slot, state]) => ({
      id      : Number(slot),
      slot    : Number(slot),
      data    : state.image,
      dataB64 : stripDataUrl(state.image),
    }));

  // ── Thresholds: one entry per image slot expected by checker engine. ──
  const minScore = Number(document.getElementById('minScoreVal')?.value || 75);
  const mustPassMandatory = document.getElementById('mustPass')?.checked || false;
  const thresholds = Object.keys(slotStates).map(slot => ({
    imgId    : Number(slot),
    useScore : true,
    scoreMin : minScore,
    mustPassMandatory,
  }));

  // ── Payload ──
  const payload = {
    labName,
    subjectId      : selectedClasses[0] || '',
    sections       : selectedSections,
    description,
    deadline,
    images,
    rules,
    thresholds,
    enableLLMCheck : false,
    createdBy      : currentTaUser?.email || 'TA',
  };
 
  // ── Loading state ──
  const btn = document.getElementById('createLabBtn');
  btn.disabled = true;
  btn.innerHTML = '<i class="ph ph-circle-notch" style="animation:spin .8s linear infinite;"></i> Creating...';
 
  try {
    const data = await apiFetch(API_ENDPOINTS.labConfig, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (data?.success) {
      showToast(`✓ Lab "${labName}" created (ID: ${data.labID})`, 'success');
      setTimeout(() => window.location.href = 'Ta_Dashboard.html', 1500);
    } else {
      showToast(`Error: ${data?.error || 'Unknown error'}`, 'error');
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
//  Loads the real lab from /labs and applies it to the form.
// ════════════════════════════════════════════════════════════
async function applyEditMode() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('mode') !== 'edit') return;
  const labId = params.get('lab');
  if (!labId) return;

  let lab = null;
  try {
    const data = await apiFetch(API_ENDPOINTS.labs);
    if (data?.success) {
      lab = (data.labs || []).find(l => getLabId(l) === labId) || null;
    }
  } catch (err) {
    console.warn('Edit mode failed to load lab metadata:', err);
    return;
  }
  if (!lab) return;

  const labName = getLabName(lab);
  document.title = `ValidMate - Edit ${labName}`;
  const headerTitle = document.querySelector('h1.text-h3');
  if (headerTitle) headerTitle.textContent = 'Edit Lab';
  const headerSub = headerTitle?.nextElementSibling;
  if (headerSub) headerSub.textContent = `Update details for ${labName}`;
  const breadcrumb = document.querySelector('.text-brand-800 .ph-file-code')?.parentElement;
  if (breadcrumb) breadcrumb.lastChild.textContent = ' Edit Lab';

  const nameInput = document.querySelector('input[placeholder="e.g., Lab 03: CPU Registers"]');
  if (nameInput) nameInput.value = labName;

  const subjectId = getSubjectId(lab);
  document.querySelectorAll('.tag-list')[0]?.querySelectorAll('.tag').forEach(t => {
    t.classList.toggle('selected', t.textContent.trim() === subjectId);
  });

  const sections = getLabSections(lab);
  document.querySelectorAll('.tag-list')[1]?.querySelectorAll('.tag').forEach(t => {
    t.classList.toggle('selected', sections.includes(t.textContent.trim()));
  });

  if (lab.deadline) {
    const date = new Date(lab.deadline);
    if (!Number.isNaN(date.getTime())) {
      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');
      const dateEl = document.querySelector('input[type="date"]');
      if (dateEl) dateEl.value = `${yyyy}-${mm}-${dd}`;
      const hh = String(date.getHours()).padStart(2, '0');
      const mn = String(date.getMinutes()).padStart(2, '0');
      const timeEl = document.querySelector('input[type="time"]');
      if (timeEl) timeEl.value = `${hh}:${mn}`;
    }
  }

  const descEl = document.querySelector('textarea');
  if (descEl) descEl.value = lab.description || '';

  const createBtn = document.getElementById('createLabBtn');
  if (createBtn) createBtn.innerHTML = '<i class="ph-bold ph-floppy-disk text-sm"></i> Update Lab';

  updateSetupProgress();
}

document.addEventListener('DOMContentLoaded', () => {
  currentTaUser = requireAuth('ta');
  if (!currentTaUser) return;
  populateNavbarUser(currentTaUser);
  applyEditMode();
});