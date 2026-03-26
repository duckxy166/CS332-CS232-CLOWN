/* ══════════════════════════════════════════
   CONFIG
══════════════════════════════════════════ */
const API_URL = 'https://s25zfr23j6.execute-api.us-east-1.amazonaws.com/dev';

/* ══════════════════════════════════════════
   STATE
══════════════════════════════════════════ */
let allLabs       = [];
let selectedLabID = null;
let submissions   = [];
let labInfo       = null;
let expandedEmail = null;

/* ══════════════════════════════════════════
   UTILS
══════════════════════════════════════════ */
function toast(msg){
  const el = document.getElementById('toast');
  el.textContent = msg; el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2500);
}

function fmtDate(iso){
  if(!iso) return '—';
  return new Date(iso).toLocaleDateString('th-TH', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function badgeHTML(status){
  const map = {
    PASSED:   { cls: 'badge-passed',   icon: '✓', label: 'PASSED' },
    REJECTED: { cls: 'badge-rejected', icon: '✗', label: 'REJECTED' },
    PENDING:  { cls: 'badge-pending',  icon: '⏳', label: 'PENDING' },
  };
  const b = map[status] || map.PENDING;
  return `<span class="badge ${b.cls}">${b.icon} ${b.label}</span>`;
}

/* ══════════════════════════════════════════
   LOAD LABS
══════════════════════════════════════════ */
async function loadLabs(){
  try {
    const res  = await fetch(`${API_URL}/labs`);
    const data = await res.json();
    const raw  = data.body ? JSON.parse(data.body) : data;
    allLabs = raw.labs || [];
    renderLabList();
  } catch(err){
    document.getElementById('labListWrap').innerHTML =
      `<div class="state-msg">โหลด Lab ไม่ได้ — ${err.message}</div>`;
  }
}

function renderLabList(){
  if(!allLabs.length){
    document.getElementById('labListWrap').innerHTML =
      `<div class="state-msg">ยังไม่มี Lab</div>`;
    return;
  }
  document.getElementById('labListWrap').innerHTML =
    `<div class="lab-list">${allLabs.map(lab => `
      <div class="lab-item ${selectedLabID === lab.labID ? 'selected' : ''}"
           onclick="selectLab('${lab.labID}')">
        <div class="lab-radio"><div class="lab-radio-dot"></div></div>
        <div class="lab-item-info">
          <div class="lab-item-name">${lab.labName}</div>
          <div class="lab-item-meta">${lab.subjectId} · section ${(lab.sections||[]).join(', ')}</div>
        </div>
      </div>`).join('')}</div>`;
}

/* ══════════════════════════════════════════
   SELECT LAB → LOAD SUBMISSIONS
══════════════════════════════════════════ */
async function selectLab(labID){
  selectedLabID = labID;
  renderLabList();
  document.getElementById('barLab').textContent = allLabs.find(l=>l.labID===labID)?.labName || labID;

  /* show loading in table area */
  document.getElementById('statsWrap').style.display = 'none';
  document.getElementById('subCard').style.display   = 'block';
  document.getElementById('dlWrap').style.display     = 'none';
  document.getElementById('subBody').innerHTML =
    `<tr><td colspan="6"><div class="state-msg"><div class="spinner"></div>กำลังโหลดรายการส่งงาน...</div></td></tr>`;

  try {
    const res  = await fetch(`${API_URL}/submissions?labID=${encodeURIComponent(labID)}`);
    const data = await res.json();
    const raw  = data.body ? JSON.parse(data.body) : data;

    if(!raw.success){ toast('Error: ' + (raw.error||'unknown')); return; }

    labInfo     = raw.lab;
    submissions = raw.submissions || [];

    renderStats(raw.stats);
    renderTable();

    /* show download button if any passed */
    const hasPassed = submissions.some(s => s.status === 'PASSED');
    document.getElementById('dlWrap').style.display = hasPassed ? 'flex' : 'none';

  } catch(err){
    document.getElementById('subBody').innerHTML =
      `<tr><td colspan="6"><div class="state-msg">โหลดไม่ได้ — ${err.message}</div></td></tr>`;
  }
}

/* ══════════════════════════════════════════
   STATS
══════════════════════════════════════════ */
function renderStats(stats){
  if(!stats) return;
  document.getElementById('statsWrap').style.display = 'block';
  document.getElementById('statsGrid').innerHTML = `
    <div class="stat-card stat-total">
      <div class="stat-val">${stats.total}</div>
      <div class="stat-lbl">Total</div>
    </div>
    <div class="stat-card stat-passed">
      <div class="stat-val">${stats.passed}</div>
      <div class="stat-lbl">Passed</div>
    </div>
    <div class="stat-card stat-rejected">
      <div class="stat-val">${stats.rejected}</div>
      <div class="stat-lbl">Rejected</div>
    </div>
    <div class="stat-card stat-pending">
      <div class="stat-val">${stats.pending}</div>
      <div class="stat-lbl">Pending</div>
    </div>`;
}

/* ══════════════════════════════════════════
   TABLE
══════════════════════════════════════════ */
function renderTable(){
  if(!submissions.length){
    document.getElementById('subBody').innerHTML =
      `<tr><td colspan="6"><div class="state-msg">ยังไม่มีคนส่งงาน</div></td></tr>`;
    return;
  }

  /* sort: PENDING first, then by submittedAt desc */
  const sorted = [...submissions].sort((a,b) => {
    if(a.status === 'PENDING' && b.status !== 'PENDING') return -1;
    if(b.status === 'PENDING' && a.status !== 'PENDING') return 1;
    return new Date(b.submittedAt||0) - new Date(a.submittedAt||0);
  });

  document.getElementById('subBody').innerHTML = sorted.map((sub, i) => {
    const isOpen = expandedEmail === sub.email;
    return `
      <tr class="sub-row" onclick="toggleDetail('${sub.email}')">
        <td class="mono">${i+1}</td>
        <td style="font-weight:500">${sub.email}</td>
        <td>${badgeHTML(sub.status)}</td>
        <td class="mono">${sub.totalScore != null ? sub.totalScore + '%' : '—'}</td>
        <td class="mono" style="font-size:11px">${fmtDate(sub.submittedAt)}</td>
        <td class="mono" style="font-size:11px">${fmtDate(sub.checkedAt)}</td>
      </tr>
      <tr class="detail-row ${isOpen ? 'open' : ''}" id="dr-${sub.email.replace(/[@.]/g,'_')}">
        <td colspan="6" class="detail-cell">
          ${detailHTML(sub)}
        </td>
      </tr>`;
  }).join('');
}

function toggleDetail(email){
  expandedEmail = expandedEmail === email ? null : email;
  renderTable();
}

function detailHTML(sub){
  /* screenshots */
  let imgsHTML = '';
  if(sub.screenshots?.length){
    imgsHTML = `<div class="detail-imgs">${sub.screenshots.map((s,i) => `
      <div class="detail-img-card">
        ${s.url
          ? `<img src="${s.url}" alt="img${s.imgId}" onclick="window.open('${s.url}','_blank')" title="คลิกเพื่อดูเต็ม">`
          : `<div style="height:120px;display:flex;align-items:center;justify-content:center;color:var(--text3);font-size:12px">ไม่สามารถโหลดรูปได้</div>`}
        <div class="detail-img-label">รูปที่ ${i+1}</div>
      </div>`).join('')}</div>`;
  }

  /* score breakdown */
  let breakdownHTML = '';
  if(sub.scoreResult?.length){
    sub.scoreResult.forEach((img, i) => {
      const imgPassed = img.status === 'PASSED';
      breakdownHTML += `<div class="rb-img-head">รูปที่ ${i+1} — ${imgPassed ? '✓ ผ่าน' : '✗ ไม่ผ่าน'} (${img.score}%)</div>`;
      (img.ruleResults||[]).forEach(r => {
        breakdownHTML += `
          <div class="rb-rule">
            <span class="rb-icon">${r.passed ? '✓' : '✗'}</span>
            <span class="rb-kw">${r.keyword}</span>
            <span class="rb-score" style="color:${r.passed ? 'var(--green)' : 'var(--red)'}">${r.score}%</span>
          </div>`;
      });
    });
  }

  return `<div class="detail-content">${imgsHTML}${breakdownHTML || '<div style="font-size:12px;color:var(--text3)">ยังไม่มีผลตรวจ</div>'}</div>`;
}

/* ══════════════════════════════════════════
   DOWNLOAD ALL
══════════════════════════════════════════ */
async function downloadAll(){
  const passed = submissions.filter(s => s.status === 'PASSED');
  if(!passed.length){ toast('ไม่มีรายการที่ผ่าน'); return; }

  /* open each presigned URL in a new tab — avoids S3 CORS restriction */
  let count = 0;
  for(const sub of passed){
    for(const shot of (sub.screenshots || [])){
      if(!shot.url) continue;
      const emailPrefix = sub.email.split('@')[0];
      const a = document.createElement('a');
      a.href     = shot.url;
      a.target   = '_blank';
      a.download = `${emailPrefix}_img${shot.imgId}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      count++;
      /* small delay between tabs to avoid browser blocking pop-ups */
      await new Promise(r => setTimeout(r, 300));
    }
  }
  toast(`✓ เปิด ${count} ลิงก์ดาวน์โหลดแล้ว — กรุณาอนุญาต pop-up หากถูกบล็อก`);

  const btn = document.getElementById('dlBtn');
  btn.disabled    = false;
  btn.textContent = '📦 DOWNLOAD ALL PASSED';
  document.getElementById('dlProgress').textContent = '';
}

/* ══════════════════════════════════════════
   INIT
══════════════════════════════════════════ */
loadLabs();