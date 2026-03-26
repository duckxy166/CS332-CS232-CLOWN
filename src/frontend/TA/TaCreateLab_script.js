/* ══════════════════════════════════════════
       STATE
    ══════════════════════════════════════════ */
    let images = [{ id: 1, src: '', thresh: 75, useScore: true, useMand: true }];
    let imgCounter = 1;
    let activeImg = 1;
    let activeRule = 1;
    let rules = [];
    let ruleCount = 0;

    // txCache: imgId → array of text blocks from real Textract
    // each block: { text, left, top, right, bottom, cx, cy }
    let txCache = {};

    /* ══════════════════════════════════════════
       UTILS
    ══════════════════════════════════════════ */
    function toast(msg) {
      const el = document.getElementById('toast');
      el.textContent = msg; el.classList.add('show');
      setTimeout(() => el.classList.remove('show'), 2000);
    }
    function imgBy(id) { return images.find(i => i.id === id); }
    function ruleBy(id) { return rules.find(r => r.id === id); }
    function imgNum(id) { return images.findIndex(i => i.id === id) + 1; }
    function imgLbl(id) { return 'รูป ' + imgNum(id); }
    function rulesOf(imgId) { return rules.filter(r => r.imgId === imgId); }
    function wtOf(imgId) { return rulesOf(imgId).reduce((s, r) => s + (+r.wt || 0), 0); }
    function wCls(t) { return t === 100 ? 'ok' : t > 100 ? 'over' : 'under'; }

    function toBase64(file){
      return new Promise((res, rej) => {
        const reader = new FileReader();
        reader.onload  = () => res(reader.result.split(',')[1]);
        reader.onerror = rej;
        reader.readAsDataURL(file);
      });
    }

    /* ══════════════════════════════════════════
       CHIPS
    ══════════════════════════════════════════ */
    const SUBJS = ['CS232', 'CS261', 'CS301', 'CS315', 'CS401', 'CS421', 'CS461'];
    const SECS = ['1001', '1002', '1003', '1004', '1101', '1102', '1201', '1202'];
    let selSubj = null, selSecs = [];

    function initChips() { renderChips('subj', ''); renderChips('sec', ''); }
    function filterChips(type, val) { renderChips(type, val.trim().toLowerCase()); }

    function renderChips(type, q) {
      const isSubj = type === 'subj';
      const pool = isSubj ? SUBJS : SECS;
      const el = document.getElementById(isSubj ? 'subjOpts' : 'secOpts');
      const vis = pool.filter(s => s.toLowerCase().includes(q));
      if (!vis.length) { el.innerHTML = `<span class="chip-none">ไม่พบ "${q}"</span>`; return; }
      el.innerHTML = vis.map(s => {
        const on = isSubj ? selSubj === s : selSecs.includes(s);
        return `<button class="chip ${on ? 'on' : ''}" onclick="${isSubj ? `toggleSubj('${s}')` : `toggleSec('${s}')`}">${s}</button>`;
      }).join('');
    }
    function toggleSubj(s) {
      selSubj = selSubj === s ? null : s;
      renderChips('subj', document.getElementById('subjSearch').value.trim().toLowerCase());
    }
    function toggleSec(s) {
      if (selSecs.includes(s)) selSecs = selSecs.filter(x => x !== s); else selSecs.push(s);
      renderChips('sec', document.getElementById('secSearch').value.trim().toLowerCase());
    }

    /* ══════════════════════════════════════════
       SECTION 2 — IMAGES
    ══════════════════════════════════════════ */
    function renderImgTabs() {
      document.getElementById('imgTabs').innerHTML =
        images.map(im => `
      <button class="itab ${im.id === activeImg ? 'on' : ''}" onclick="switchImg(${im.id})">
        ${im.src ? '✓ ' : ''}${imgLbl(im.id)}
        ${images.length > 1 ? `<span class="x" onclick="event.stopPropagation();delImg(${im.id})">×</span>` : ''}
      </button>`).join('')
        + `<button class="itab-add" onclick="addImg()">+ เพิ่มรูป</button>`;
    }

    function renderImgPanels() {
      document.getElementById('imgPanels').innerHTML = images.map(im => `
    <div id="ip-${im.id}" style="display:${im.id === activeImg ? 'block' : 'none'}">
      ${im.src
          ? `<div class="preview">
            <img src="${im.src}" alt="">
            <div class="preview-hint">${imgLbl(im.id)} — กำหนดพื้นที่ตรวจบนรูปนี้ได้ใน Key Rules</div>
            <div class="preview-change" onclick="document.getElementById('fi-${im.id}').click()">เปลี่ยนรูป</div>
            <input type="file" id="fi-${im.id}" accept="image/*" style="display:none" onchange="onUpload(event,${im.id})">
          </div>`
          : `<div class="upload" onclick="document.getElementById('fi-${im.id}').click()">
            <input type="file" id="fi-${im.id}" accept="image/*" onchange="onUpload(event,${im.id})">
            <div class="upload-icon">🖼</div>
            <div class="upload-text"><strong>คลิกเพื่ออัปโหลด</strong> ${imgLbl(im.id)}<br><span style="font-size:11px">PNG / JPG ไม่เกิน 5MB</span></div>
          </div>`
        }
    </div>`).join('');
    }

    function switchImg(id) { activeImg = id; renderImgTabs(); renderImgPanels(); }

    function addImg() {
      imgCounter++;
      images.push({ id: imgCounter, src: '', thresh: 75, useScore: true, useMand: true });
      activeImg = imgCounter; activeRule = imgCounter;
      renderAll(); toast('เพิ่ม ' + imgLbl(imgCounter) + ' แล้ว');
    }

    function delImg(id) {
      if (images.length <= 1) { toast('ต้องมีอย่างน้อย 1 รูป'); return; }
      const lbl = imgLbl(id);
      images = images.filter(i => i.id !== id);
      rules.forEach(r => { if (r.imgId === id) r.imgId = images[0].id; });
      if (activeImg === id) activeImg = images[0].id;
      if (activeRule === id) activeRule = images[0].id;
      renderAll(); toast(lbl + ' ถูกลบแล้ว');
    }

    async function onUpload(e, imgId) {
      const f = e.target.files[0]; if (!f) return;

      /* show local preview immediately */
      const im = imgBy(imgId);
      if (im) im.src = URL.createObjectURL(f);
      renderImgTabs(); renderImgPanels();
      toast('กำลังอัปโหลดและสแกน ' + imgLbl(imgId) + '...');

      /* reset cache for this image — new upload means old blocks invalid */
      txCache[imgId] = null;

      /* reset txStatus for all rules in this image */
      rules.filter(r => r.imgId === imgId).forEach(r => {
        if(r.pos){ r.pos = false; r.txStatus = null; r.refX = null; r.refY = null; }
      });

      try {
        const base64 = await toBase64(f);

        /* need a temp labID for S3 key — use timestamp if lab not created yet */
        const tempLabID = 'ref-temp-' + Date.now();

        const res  = await fetch(`${API_URL}/reference`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: base64,
            imageType: f.type,
            labID: tempLabID
          })
        });

        const data   = await res.json();
        const result = data.body ? JSON.parse(data.body) : data;

        if(result.success){
          /* store real Textract blocks in cache for this imgId */
          txCache[imgId] = result.blocks;
          toast('✓ ' + imgLbl(imgId) + ' พร้อมใช้งาน — พบ ' + result.blocks.length + ' text blocks');
        } else {
          toast('Textract error: ' + (result.error || 'unknown'));
        }

      } catch(err) {
        toast('อัปโหลดไม่สำเร็จ — ' + err.message);
      }
    }

    /* ══════════════════════════════════════════
       SECTION 3 — RULE TABS
    ══════════════════════════════════════════ */
    function renderRuleTabs() {
      const dotColor = im => { const c = wCls(wtOf(im.id)); return c === 'ok' ? 'var(--green)' : c === 'over' ? 'var(--red)' : 'var(--amber)'; };
      document.getElementById('ruleTabs').innerHTML = images.map(im => `
    <button class="itab ${im.id === activeRule ? 'on' : ''}" onclick="switchRuleTab(${im.id})">
      <span style="width:6px;height:6px;border-radius:50%;background:${dotColor(im)};display:inline-block;flex-shrink:0"></span>
      ${imgLbl(im.id)}
    </button>`).join('');
    }

    function switchRuleTab(id) { activeRule = id; renderRuleTabs(); renderRuleContent(); }

    /* ══════════════════════════════════════════
       RULE CONTENT — full render only on add/del/tab
    ══════════════════════════════════════════ */
    function renderRuleContent() {
      const rs = rulesOf(activeRule);
      const el = document.getElementById('ruleContent');

      const rulesHTML = rs.length === 0
        ? `<div class="empty-rules">ยังไม่มี Key Rule — กด "+ เพิ่ม Key Rule" ด้านล่าง</div>`
        : `<div class="rules-header">
        <span></span>
        <span class="rh-title">Text Keyword Rule</span>
        <span class="rh-wt">Weight</span>
        <span></span>
      </div>
      <div class="rules-wrap" id="rlist">${rs.map((r, i) => ruleHTML(r, i + 1)).join('')}</div>`;

      el.innerHTML = rulesHTML + `<button class="add-rule" onclick="addRule(${activeRule})">+ เพิ่ม Key Rule ใน ${imgLbl(activeRule)}</button>`;
    }

    function ruleHTML(r, n) {
      const posBtn = `
    <button class="pos-area-btn ${r.pos ? 'on' : ''}" onclick="togglePos(${r.id})" id="pab-${r.id}">
      <span class="pab-check">${r.pos ? '✓' : ''}</span>
      SET Text Position Rule
    </button>`;

      // status strip — only shown when pos is ON
      let statusHTML = '';
      if (r.pos) {
        if (r.txStatus === 'loading') {
          statusHTML = `<div class="tx-status loading" id="txs-${r.id}">
        <span class="tx-icon">⏳</span>
        <span class="tx-text">กำลังตรวจสอบ keyword ใน reference image...</span>
      </div>`;
        } else if (r.txStatus === 'found') {
          statusHTML = `<div class="tx-status found" id="txs-${r.id}">
        <span class="tx-icon">✓</span>
        <span class="tx-text">พบ keyword ใน reference image</span>
        <span class="tx-pos">x:${r.refX?.toFixed(2)} y:${r.refY?.toFixed(2)}</span>
      </div>`;
        } else if (r.txStatus === 'notfound') {
          statusHTML = `<div class="tx-status notfound" id="txs-${r.id}">
        <span class="tx-icon">✗</span>
        <span class="tx-text">ไม่พบ keyword นี้ใน reference image — ตรวจสอบ keyword อีกครั้ง</span>
      </div>`;
        }
      }

      const sensPanelVisible = r.pos && r.txStatus === 'found';

      return `
  <div class="rule-row" id="rr-${r.id}">
    <div class="rule-main">
      <span class="rule-idx">${n}</span>
      <input class="rule-kw" id="kw-${r.id}" value="${r.kw}" placeholder="keyword เช่น successfully created"
        oninput="onKw(${r.id},this.value)">
      <div class="wt-wrap">
        <input class="rule-wt" id="wt-${r.id}" type="number" value="${r.wt}" placeholder="0" min="0" max="100"
          oninput="onWt(${r.id},this.value)">
        <span class="wt-pct">%</span>
      </div>
      <button class="rule-del" onclick="delRule(${r.id})">×</button>
    </div>
    <div class="pos-check-row">
      ${posBtn}
    </div>
    <div class="pos-panel ${r.pos ? 'open' : ''}" id="pp-${r.id}">
      ${statusHTML}
      <div class="sens-wrap ${sensPanelVisible ? 'visible' : ''}" id="sw-${r.id}">
        <div class="pos-section-lbl">Sensitivity — ความคลาดเคลื่อนที่ยอมรับได้</div>
        <div class="sens-pills">
          <button class="sp ${r.sens === 'low' ? 'on' : ''}" onclick="setSens(${r.id},'low')">
            Low <span class="sp-val">±30%</span>
          </button>
          <button class="sp ${r.sens === 'medium' ? 'on' : ''}" onclick="setSens(${r.id},'medium')">
            Medium <span class="sp-val">±15%</span>
          </button>
          <button class="sp ${r.sens === 'high' ? 'on' : ''}" onclick="setSens(${r.id},'high')">
            High <span class="sp-val">±5%</span>
          </button>
        </div>
      </div>
    </div>
  </div>`;
    }

    /* ══════════════════════════════════════════
       RULE ACTIONS
    ══════════════════════════════════════════ */
    function addRule(imgId) {
      ruleCount++;
      rules.push({ id: ruleCount, kw: '', wt: 0, pos: false, sens: 'medium', txStatus: null, refX: null, refY: null, mand: false, imgId });
      renderRuleContent(); renderWbars(); renderRuleTabs();
      toast('เพิ่ม Key Rule แล้ว');
    }

    function delRule(id) {
      rules = rules.filter(r => r.id !== id);
      renderRuleContent(); renderWbars(); renderRuleTabs();
    }

    /* keyword / weight — patch weight bar only, NO rule re-render */
    function onKw(id, val) {
      const r = ruleBy(id); if (!r) return;
      // if keyword changed while pos is ON, reset textract status
      if (r.pos && r.kw !== val) {
        r.kw = val; r.txStatus = null; r.refX = null; r.refY = null;
        patchPosPanel(r);
      } else {
        r.kw = val;
      }
      renderWbars(); renderRuleTabs();
    }
    function onWt(id, val) {
      const r = ruleBy(id); if (r) r.wt = parseInt(val) || 0;
      renderWbars(); renderRuleTabs();
    }

    /* ── position toggle — Option 2: trigger Textract here ── */
    function togglePos(id) {
      const r = ruleBy(id); if (!r) return;

      if (r.pos) {
        // turning OFF — clear everything
        r.pos = false; r.txStatus = null; r.refX = null; r.refY = null;
        const btn = document.getElementById('pab-' + id);
        if (btn) { btn.classList.remove('on'); btn.querySelector('.pab-check').textContent = ''; }
        const pp = document.getElementById('pp-' + id);
        if (pp) pp.classList.remove('open');
        renderWbars(); return;
      }

      // turning ON
      const im = imgBy(r.imgId);
      if (!im || !im.src) { toast('อัปโหลด ' + imgLbl(r.imgId) + ' ก่อนใช้ Text Position'); return; }
      if (!r.kw.trim()) { toast('ใส่ keyword ก่อนเปิด Text Position'); return; }

      r.pos = true; r.txStatus = 'loading';
      const btn = document.getElementById('pab-' + id);
      if (btn) { btn.classList.add('on'); btn.querySelector('.pab-check').textContent = '✓'; }
      const pp = document.getElementById('pp-' + id);
      if (pp) pp.classList.add('open');
      patchPosPanel(r);
      renderWbars();

      // ── simulate Textract call (replace with real Lambda call in production) ──
      callTextract(r);
    }

    /* real Textract lookup — uses blocks cached from referenceUpload Lambda */
    function callTextract(r) {
      const kw     = r.kw.trim().toLowerCase();
      const blocks = txCache[r.imgId];

      if(!blocks || blocks.length === 0){
        /* no cache — image not uploaded yet or upload failed */
        r.txStatus = 'notfound'; r.refX = null; r.refY = null;
        r.pos = false;
        const btn = document.getElementById('pab-' + r.id);
        if(btn){ btn.classList.remove('on'); btn.querySelector('.pab-check').textContent = ''; }
        patchPosPanel(r); renderWbars();
        toast('อัปโหลด ' + imgLbl(r.imgId) + ' ก่อนใช้ Text Position');
        return;
      }

      /* search keyword in real Textract blocks */
      const match = blocks.find(b => b.text.toLowerCase().includes(kw));

      if(match){
        r.txStatus = 'found';
        r.refX     = match.cx;
        r.refY     = match.cy;
        console.log(`keyword "${kw}" found at cx:${match.cx.toFixed(3)} cy:${match.cy.toFixed(3)}`);
      } else {
        r.txStatus = 'notfound'; r.refX = null; r.refY = null;
        r.pos = false;
        const btn = document.getElementById('pab-' + r.id);
        if(btn){ btn.classList.remove('on'); btn.querySelector('.pab-check').textContent = ''; }
      }

      patchPosPanel(r);
      renderWbars();
    }

    /* patch only the pos panel content without full re-render */
    function patchPosPanel(r) {
      const pp = document.getElementById('pp-' + r.id);
      if (!pp) return;

      let statusHTML = '';
      if (r.txStatus === 'loading') {
        statusHTML = `<div class="tx-status loading" id="txs-${r.id}">
      <span class="tx-icon">⏳</span>
      <span class="tx-text">กำลังตรวจสอบ keyword ใน reference image...</span>
    </div>`;
      } else if (r.txStatus === 'found') {
        statusHTML = `<div class="tx-status found" id="txs-${r.id}">
      <span class="tx-icon">✓</span>
      <span class="tx-text">พบ keyword ใน reference image</span>
      <span class="tx-pos">x:${r.refX?.toFixed(2)} y:${r.refY?.toFixed(2)}</span>
    </div>`;
      } else if (r.txStatus === 'notfound') {
        statusHTML = `<div class="tx-status notfound" id="txs-${r.id}">
      <span class="tx-icon">✗</span>
      <span class="tx-text">ไม่พบ keyword นี้ใน reference image — ตรวจสอบ keyword อีกครั้ง</span>
    </div>`;
      }

      const existing = pp.querySelector('.tx-status');
      if (existing) existing.outerHTML = statusHTML;
      else if (statusHTML) pp.insertAdjacentHTML('afterbegin', statusHTML);

      const sw = document.getElementById('sw-' + r.id);
      if (sw) sw.classList.toggle('visible', r.txStatus === 'found');
    }

    function setSens(id, val) {
      const r = ruleBy(id); if (r) r.sens = val;
      document.querySelectorAll(`#pp-${id} .sp`).forEach(el => {
        const txt = el.childNodes[0].textContent.trim().toLowerCase();
        el.classList.toggle('on', txt === val);
      });
    }

    /* ══════════════════════════════════════════
       WEIGHT BARS + THRESHOLD
    ══════════════════════════════════════════ */
    function renderWbars() {
      document.getElementById('wbars').innerHTML = images.map(im => {
        const rs = rulesOf(im.id);
        const tot = wtOf(im.id);
        const cls = wCls(tot);
        return `
    <div class="wbar-block">
      <div class="wbar-header">
        <span class="wbar-lbl">${imgLbl(im.id)}</span>
        <span class="wbar-val ${cls}">${tot} / 100%</span>
      </div>
      <div class="wbar-track">
        <div class="wbar-fill ${cls === 'ok' ? '' : cls}" style="width:${Math.min(tot, 100)}%"></div>
      </div>
      ${rs.length ? `
      <div class="wbar-rows">
        ${rs.map(r => `
          <div class="wbar-row">
            <div class="wbar-dot ${r.pos ? 'dot-pos' : 'dot-kw'}"></div>
            <span class="wbar-name">${r.kw || '(ยังไม่ระบุ)'}</span>
            <span class="wbar-badge ${r.pos ? 'badge-pos' : 'badge-kw'}">${r.pos ? 'KEYWORD + POSITION' : 'KEYWORD ONLY'}</span>
            <span class="wbar-pct">${r.wt}%</span>
          </div>`).join('')}
      </div>`: ''}

      <div class="thresh">
        <div class="thresh-title">Pass Threshold</div>
        <div class="thresh-row">
          <input type="checkbox" class="thresh-check" ${im.useScore ? 'checked' : ''} onchange="setUseScore(${im.id},this.checked)">
          <span class="thresh-lbl">Total Score</span>
          <div class="thresh-score">
            <span>≥</span>
            <input type="number" class="thresh-num" value="${im.thresh}" min="0" max="100" oninput="setThresh(${im.id},this.value)">
            <span>%</span>
          </div>
        </div>
        <div class="thresh-row">
          <input type="checkbox" class="thresh-check" ${im.useMand ? 'checked' : ''} onchange="setUseMand(${im.id},this.checked)">
          <span class="thresh-lbl">Mandatory Rules</span>
        </div>
        <div class="mand-list">
          ${rs.length === 0
            ? `<div style="font-size:11px;color:var(--text3)">ยังไม่มี Key Rule</div>`
            : rs.map(r => `
              <div class="mand-item">
                <span class="mand-mode ${r.pos ? 'mode-pos' : 'mode-kw'}">${r.pos ? 'KEYWORD + POSITION' : 'KEYWORD ONLY'}</span>
                <span class="mand-name">${r.kw || '(ยังไม่ระบุ)'}</span>
                <div class="mand-tw">
                  <span class="mand-tw-lbl">Mandatory</span>
                  <label class="tog">
                    <input type="checkbox" ${r.mand ? 'checked' : ''} onchange="setMand(${r.id},this.checked)">
                    <span class="tog-sl"></span>
                  </label>
                </div>
              </div>`).join('')
          }
        </div>
      </div>
    </div>`;
      }).join('');
    }

    function setThresh(imgId, v) { const im = imgBy(imgId); if (im) im.thresh = parseInt(v) || 0; }
    function setUseScore(imgId, v) { const im = imgBy(imgId); if (im) im.useScore = v; }
    function setUseMand(imgId, v) { const im = imgBy(imgId); if (im) im.useMand = v; }
    function setMand(id, v) { const r = ruleBy(id); if (r) r.mand = v; }

    /* ══════════════════════════════════════════
       DEADLINE
    ══════════════════════════════════════════ */

    /**
     * updateDeadlineBadge — แสดง badge สรุปวันหมดเขตเมื่อเลือกวันแล้ว
     */
    function updateDeadlineBadge() {
      const date = document.getElementById('deadlineDate').value;
      const time = document.getElementById('deadlineTime').value;
      const badge = document.getElementById('deadlineBadge');
      const text = document.getElementById('deadlineBadgeText');

      if (!date) { badge.classList.remove('show'); return; }

      /* แปลงวันเป็น Thai format */
      const d = new Date(date + 'T' + (time || '23:59'));
      const formatted = d.toLocaleDateString('th-TH', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
      });
      text.textContent = `หมดเขต ${formatted} เวลา ${time || '23:59'} น.`;
      badge.classList.add('show');
    }

    /**
     * getDeadlineISO — คืน ISO string ของ deadline สำหรับบันทึกลง DynamoDB
     */
    function getDeadlineISO() {
      const date = document.getElementById('deadlineDate').value;
      const time = document.getElementById('deadlineTime').value || '23:59';
      if (!date) return null;
      return new Date(date + 'T' + time + ':00').toISOString();
    }
    /* API Gateway endpoint */
    const API_URL = 'https://s25zfr23j6.execute-api.us-east-1.amazonaws.com/dev';

    async function createLab() {
      /* ── validation ── */
      if (!selSubj) { toast('เลือกชื่อวิชาก่อน'); return; }
      if (!document.getElementById('labName').value) { toast('ใส่ชื่อ Lab ก่อน'); return; }
      if (!selSecs.length) { toast('เลือก Section ก่อน'); return; }
      if (!rules.length) { toast('เพิ่มอย่างน้อย 1 Key Rule'); return; }

      const deadlineISO = getDeadlineISO();
      if (!deadlineISO) { toast('กรุณาตั้งวันหมดเขตก่อน'); return; }
      if (new Date(deadlineISO) <= new Date()) { toast('วันหมดเขตต้องเป็นวันในอนาคต'); return; }

      for (const im of images) {
        const rs = rulesOf(im.id); if (!rs.length) continue;
        const tot = wtOf(im.id);
        if (tot !== 100) { toast(imgLbl(im.id) + ': weight รวมต้องเท่ากับ 100% (ตอนนี้ ' + tot + '%)'); return; }
        for (const r of rs) {
          if (r.pos && r.txStatus === 'loading') { toast('"' + r.kw + '" กำลังตรวจสอบ — รอสักครู่'); return; }
          if (r.pos && r.txStatus !== 'found') { toast('"' + r.kw + '" ตรวจตำแหน่งไม่สำเร็จ — ปิด position หรือแก้ไข keyword'); return; }
        }
      }

      /* ── build payload ── */
      const payload = {
        labName: document.getElementById('labName').value.trim(),
        subjectId: selSubj,
        sections: selSecs,
        description: document.querySelector('textarea')?.value || '',
        deadline: deadlineISO,
        images: images.map(im => ({ id: im.id, displayNum: imgNum(im.id) })),
        rules: rules.map(r => ({
          id: r.id,
          kw: r.kw,
          wt: r.wt,
          pos: r.pos,
          sens: r.sens,
          refX: r.refX || null,
          refY: r.refY || null,
          mand: r.mand,
          imgId: r.imgId
        })),
        thresholds: images.map(im => ({
          imgId: im.id,
          useScore: im.useScore,
          scoreMin: im.thresh,
          useMand: im.useMand
        })),
        createdBy: 'TA'
      };

      /* ── disable button + show loading ── */
      const btn = document.querySelector('.create-btn');
      btn.disabled = true;
      btn.textContent = 'กำลังสร้าง Lab...';

      try {
        const res = await fetch(`${API_URL}/labs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const data = await res.json();
        const result = data.body ? JSON.parse(data.body) : data;

        if (result.success) {
          toast('✓ สร้าง Lab เรียบร้อย — ID: ' + result.labID);
          btn.textContent = '✓ CREATE LAB';
          btn.style.background = 'var(--green)';
        } else {
          toast('เกิดข้อผิดพลาด: ' + (result.error || 'unknown'));
          btn.disabled = false;
          btn.textContent = 'CREATE LAB';
        }

      } catch (err) {
        toast('เชื่อมต่อ API ไม่ได้ — ' + err.message);
        btn.disabled = false;
        btn.textContent = 'CREATE LAB';
      }
    }

    /* ══════════════════════════════════════════
       INIT
    ══════════════════════════════════════════ */
    function renderAll() {
      renderImgTabs(); renderImgPanels();
      renderRuleTabs(); renderRuleContent();
      renderWbars();
    }

    rules = [
      { id: 1, kw: 'successfully created', wt: 40, pos: false, sens: 'medium', txStatus: null, refX: null, refY: null, mand: true, imgId: 1 },
      { id: 2, kw: 'integration-lab', wt: 40, pos: false, sens: 'medium', txStatus: null, refX: null, refY: null, mand: false, imgId: 1 },
      { id: 3, kw: 'us-east-1', wt: 20, pos: false, sens: 'medium', txStatus: null, refX: null, refY: null, mand: false, imgId: 1 },
    ];
    ruleCount = 3;
    renderAll();
    initChips();