/* studentSubmission_script.js — real backend submission */

const uploads = [null, null, null];
let activeTab = 0;
let currentUser = null;
let activeLab = null;

function getLabIdFromUrl() {
  const p = new URLSearchParams(window.location.search);
  return p.get('labID') || p.get('lab') || '';
}

async function loadLabContext() {
  currentUser = requireAuth('student');
  if (!currentUser) return;
  populateNavbarUser(currentUser);
  const labID = getLabIdFromUrl();
  if (!labID) return;
  try {
    const data = await apiFetch(API_ENDPOINTS.labs);
    if (!data?.success) return;
    activeLab = (data.labs || []).find(l => getLabId(l) === labID) || null;
    if (activeLab) renderLabHeader(activeLab);
  } catch (err) {
    console.warn('Could not load lab metadata:', err);
  }
}

function renderLabHeader(lab) {
  document.querySelectorAll('[data-lab-name]').forEach(el => { el.textContent = getLabName(lab); });
  document.querySelectorAll('[data-lab-subject]').forEach(el => { el.textContent = getSubjectId(lab); });
  document.querySelectorAll('[data-lab-deadline]').forEach(el => { el.textContent = formatDateLabel(lab.deadline); });
  document.querySelectorAll('[data-lab-description]').forEach(el => { el.textContent = lab.description || ''; });
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(stripDataUrl(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

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
  const ph  = document.getElementById('dropPlaceholder');
  const pv  = document.getElementById('dropPreview');
  const fn  = document.getElementById('fileName');
  const img = document.getElementById('previewImg');
  if (uploads[activeTab]) {
    ph.style.display = 'none';
    pv.style.display = 'flex';
    fn.textContent   = uploads[activeTab].file.name;
    if (img) img.src = uploads[activeTab].url;
  } else {
    ph.style.display = 'flex';
    pv.style.display = 'none';
    if (img) img.src = '';
  }
}

/* ── OpenCV Blur Detection ── */
const BLUR_THRESHOLD = 100;

function computeBlurScore(imageMat) {
  var resized = new cv.Mat();
  var targetWidth = 600;
  if (imageMat.cols > targetWidth) {
    var scale = targetWidth / imageMat.cols;
    var targetHeight = Math.round(imageMat.rows * scale);
    cv.resize(imageMat, resized, new cv.Size(targetWidth, targetHeight), 0, 0, cv.INTER_LINEAR);
  } else {
    imageMat.copyTo(resized);
  }
  var gray = new cv.Mat();
  cv.cvtColor(resized, gray, cv.COLOR_RGBA2GRAY);
  var gradX = new cv.Mat();
  var gradY = new cv.Mat();
  cv.Sobel(gray, gradX, cv.CV_64F, 1, 0, 3, 1, 0, cv.BORDER_DEFAULT);
  cv.Sobel(gray, gradY, cv.CV_64F, 0, 1, 3, 1, 0, cv.BORDER_DEFAULT);
  var meanX = new cv.Mat(), stdX = new cv.Mat();
  var meanY = new cv.Mat(), stdY = new cv.Mat();
  cv.meanStdDev(gradX, meanX, stdX);
  cv.meanStdDev(gradY, meanY, stdY);
  var varX = stdX.data64F[0] * stdX.data64F[0];
  var varY = stdY.data64F[0] * stdY.data64F[0];
  var score = Math.min(varX, varY) / 10;
  resized.delete(); gray.delete();
  gradX.delete(); gradY.delete();
  meanX.delete(); stdX.delete(); meanY.delete(); stdY.delete();
  return score;
}

async function checkImageBlur(file) {
  if (!cvReady) {
    toast('Blur detection is still loading, please wait...', 'error');
    return false;
  }
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;
  await img.decode();
  const canvas = document.getElementById('canvasBlurCheck');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  canvas.getContext('2d').drawImage(img, 0, 0);
  const imgMat = cv.imread(canvas);
  const score = computeBlurScore(imgMat);
  imgMat.delete();
  URL.revokeObjectURL(url);
  const isSharp = score >= BLUR_THRESHOLD;
  showBlurFeedback(isSharp, score);
  return isSharp;
}

function showBlurFeedback(isSharp, score) {
  const fb = document.getElementById('blurFeedback');
  fb.style.display = 'flex';
  if (isSharp) {
    fb.style.background = '#ECFDF5';
    fb.style.color = '#10B981';
    fb.style.border = '1px solid #A7F3D0';
    fb.innerHTML = '<i class="ph ph-check-circle" style="font-size:16px"></i> Sharp image (Score: ' + score.toFixed(1) + ')';
  } else {
    fb.style.background = '#FEF2F2';
    fb.style.color = '#EF4444';
    fb.style.border = '1px solid #FECACA';
    fb.innerHTML = '<i class="ph ph-x-circle" style="font-size:16px"></i> Blurry image rejected (Score: ' + score.toFixed(1) + ' / Need: ' + BLUR_THRESHOLD + ')';
  }
}

function hideBlurFeedback() {
  var fb = document.getElementById('blurFeedback');
  if (fb) fb.style.display = 'none';
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

/* ── Save file to slot (with blur check) ── */
async function save(file) {
  const ok = ['image/jpeg','image/png'].includes(file.type) && file.size <= 15*1024*1024;
  if (!ok) { toast('Only .jpg/.png up to 15 MB', 'error'); return; }

  const isSharp = await checkImageBlur(file);
  if (!isSharp) {
    toast('Image is too blurry — please upload a sharper screenshot', 'error');
    return;
  }

  if (uploads[activeTab]?.url) URL.revokeObjectURL(uploads[activeTab].url);
  uploads[activeTab] = { file, url: URL.createObjectURL(file) };
  renderZone();
  updateStatus();
}

/* ── Clear ── */
function clearFile(e) {
  e.stopPropagation();
  if (uploads[activeTab]?.url) URL.revokeObjectURL(uploads[activeTab].url);
  uploads[activeTab] = null;
  renderZone();
  updateStatus();
  hideBlurFeedback();
}

/* ── Lightbox ── */
function openLightbox() {
  const slot = uploads[activeTab];
  if (!slot) return;
  const lb  = document.getElementById('lightbox');
  const img = document.getElementById('lightboxImg');
  img.src = slot.url;
  lb.style.display = 'flex';
}

function closeLightbox() {
  document.getElementById('lightbox').style.display = 'none';
}

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
    icon.className             = 'ph ph-hourglass-medium';
    label.textContent          = 'Pending Upload';
  } else if (n < 3) {
    card.style.borderLeftColor = '#4F46E5';
    wrap.style.background      = '#EEF2FF';
    icon.style.color           = '#4F46E5';
    icon.className             = 'ph ph-upload-simple';
    label.textContent          = n + ' of 3 Uploaded';
  } else {
    card.style.borderLeftColor = '#10B981';
    wrap.style.background      = '#ECFDF5';
    icon.style.color           = '#10B981';
    icon.className             = 'ph ph-check-circle';
    label.textContent          = 'Ready to Submit';
  }
}

/* ── Submit ── */
async function handleSubmit() {
  const filledUploads = uploads.filter(Boolean);
  if (!filledUploads.length) {
    toast('Upload at least one screenshot first.', 'error');
    return;
  }
  if (!currentUser) currentUser = requireAuth('student');
  if (!currentUser) return;
  const labID = getLabIdFromUrl();
  if (!labID) {
    toast('Missing lab id in URL.', 'error');
    return;
  }

  const btn = document.getElementById('submitBtn');
  btn.disabled  = true;
  btn.innerHTML = '<i class="ph-fill ph-spinner-gap"></i> Submitting…';

  try {
    const screenshots = await Promise.all(uploads.map(async (slot, idx) => {
      if (!slot) return null;
      const imageBase64 = await fileToBase64(slot.file);
      return { imgId: idx + 1, imageBase64, imageType: slot.file.type || 'image/png' };
    }));
    const payload = {
      email: currentUser.email,
      labID,
      screenshots: screenshots.filter(Boolean),
    };
    const data = await apiFetch(API_ENDPOINTS.submission, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (!data?.success) throw new Error(data?.error || 'Submission failed');
    btn.style.background = '#10B981';
    btn.innerHTML = '<i class="ph-fill ph-check-circle"></i> Submitted!';
    toast('Lab evidence submitted!', 'success');
    setTimeout(() => {
      const classID = new URLSearchParams(window.location.search).get('classID') || '';
      window.location.href = `submissionResult.html?labID=${encodeURIComponent(labID)}&classID=${encodeURIComponent(classID)}&state=processing`;
    }, 600);
  } catch (err) {
    console.error('Submit error:', err);
    toast(err.message || 'Submission failed', 'error');
    btn.disabled = false;
    btn.innerHTML = '<i class="ph-bold ph-paper-plane-tilt text-sm"></i> Submit Lab Evidence';
  }
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

/* ── Keyboard shortcuts ── */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeLightbox();
});

/* ── Init ── */
switchTab(0);
loadLabContext();