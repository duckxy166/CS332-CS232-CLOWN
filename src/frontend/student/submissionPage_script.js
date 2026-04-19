/* studentSubmission_script.js */

const uploads = [null, null, null];
let activeTab = 0;

/* ── Tabs ── */
function switchTab(idx) {
  activeTab = idx;
  [0,1,2].forEach(i => {
    const b = document.getElementById('tab-'+i);
    if (i === idx) {
      b.style.color       = '#4F46E5';
      b.style.fontWeight  = '700';
      b.style.borderBottom = '2px solid #4F46E5';
    } else {
      b.style.color       = '#94A3B8';
      b.style.fontWeight  = '500';
      b.style.borderBottom = '2px solid transparent';
    }
  });
  renderZone();
}

/* ── Render drop zone ── */
function renderZone() {
  const ph = document.getElementById('dropPlaceholder');
  const pv = document.getElementById('dropPreview');
  const fn = document.getElementById('fileName');
  if (uploads[activeTab]) {
    ph.style.display = 'none';
    pv.style.display = 'flex';
    fn.textContent   = uploads[activeTab].name;
  } else {
    ph.style.display = 'flex';
    pv.style.display = 'none';
  }
}

/* ── File input change ── */
function handleFileSelect(e) {
  const file = e.target.files[0];
  if (file) save(file);
  e.target.value = '';
}

/* ── Drag & drop ── */
function handleDrop(e) {
  e.preventDefault();
  const dz = document.getElementById('dropZone');
  dz.style.borderColor = '#CBD5E1';
  dz.style.background  = '#FAFBFC';
  const file = e.dataTransfer.files[0];
  if (file) save(file);
}

/* ── Save file to slot ── */
function save(file) {
  const ok = ['image/jpeg','image/png'].includes(file.type) && file.size <= 15*1024*1024;
  if (!ok) { toast('Only .jpg/.png up to 15 MB', 'error'); return; }
  uploads[activeTab] = file;
  renderZone();
  updateStatus();
}

/* ── Clear ── */
function clearFile(e) {
  e.stopPropagation();
  uploads[activeTab] = null;
  renderZone();
  updateStatus();
}

/* dots removed */

/* ── Status card ── */
function updateStatus() {
  const n     = uploads.filter(Boolean).length;
  const card  = document.getElementById('statusCard');
  const wrap  = document.getElementById('statusIconWrap');
  const icon  = document.getElementById('statusIcon');
  const label = document.getElementById('currentStatus');
  if (n === 0) {
    card.style.borderLeftColor = '#F59E0B';
    wrap.style.background      = '#FFFBEB';
    icon.style.color           = '#F59E0B';
    icon.className             = 'ph-fill ph-hourglass-medium';
    label.textContent          = 'Pending Upload';
  } else if (n < 3) {
    card.style.borderLeftColor = '#4F46E5';
    wrap.style.background      = '#EEF2FF';
    icon.style.color           = '#4F46E5';
    icon.className             = 'ph-fill ph-upload-simple';
    label.textContent          = n + ' of 3 Uploaded';
  } else {
    card.style.borderLeftColor = '#10B981';
    wrap.style.background      = '#ECFDF5';
    icon.style.color           = '#10B981';
    icon.className             = 'ph-fill ph-check-circle';
    label.textContent          = 'Ready to Submit';
  }
}

/* ── Submit ── */
function handleSubmit() {
  if (!uploads.filter(Boolean).length) {
    toast('Upload at least one screenshot first.', 'error');
    return;
  }
  const btn = document.getElementById('submitBtn');
  btn.disabled   = true;
  btn.innerHTML  = '<i class="ph-fill ph-spinner-gap"></i> Submitting…';
  setTimeout(() => {
    btn.style.background = '#10B981';
    btn.innerHTML = '<i class="ph-fill ph-check-circle"></i> Submitted!';
    toast('Lab evidence submitted!', 'success');
  }, 1500);
}

/* ── Toast ── */
function toast(msg, type) {
  document.getElementById('_toast')?.remove();
  const el = document.createElement('div');
  el.id = '_toast';
  el.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:9999;display:flex;align-items:center;gap:8px;padding:12px 18px;border-radius:12px;font-size:13px;font-weight:600;box-shadow:0 4px 20px rgba(0,0,0,.15);'
    + (type === 'error' ? 'background:#FEF2F2;color:#EF4444;border:1px solid #FECACA' : 'background:#0F172A;color:#fff');
  el.innerHTML = '<i class="' + (type==='error'?'ph-fill ph-warning-circle':'ph-fill ph-check-circle') + '"></i>' + msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

/* ── Init ── */
switchTab(0);