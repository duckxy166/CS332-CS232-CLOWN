// Animate progress bars on load
    window.addEventListener('load', () => {
      document.querySelectorAll('.progress-fill').forEach(bar => {
        const target = bar.dataset.width;
        setTimeout(() => { bar.style.width = target; }, 100);
      });
    });
 
    // Search/filter cards
    function filterCards() {
      const q = document.getElementById('searchInput').value.toLowerCase();
      document.querySelectorAll('.class-card').forEach(card => {
        const name = card.dataset.name || '';
        card.style.display = name.includes(q) ? '' : 'none';
      });
    }
//----------------------------------------------------------------

// TODO: เปลี่ยน URL ตรงนี้เมื่อ deploy API Gateway แล้ว
const API_BASE_URL = "https://YOUR_API_GATEWAY_URL/prod";
 
const ENDPOINTS = {
  labLister: `${API_BASE_URL}/lab-lister`,
};
 
// ── COLOR PALETTE สำหรับ class card ─────────────────────────
const CARD_COLORS = ["purple", "blue", "green", "amber", "pink"];
 
function getCardColor(index) {
  return CARD_COLORS[index % CARD_COLORS.length];
}
 
// ── FORMAT วันที่ deadline ───────────────────────────────────
function formatDeadline(isoString) {
  if (!isoString) return "N/A";
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = date - now;
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
 
  if (diffDays < 0) return "OVERDUE";
  if (diffDays === 0) return "TODAY";
  if (diffDays === 1) return "TOMORROW";
  if (diffDays <= 7) return `IN ${diffDays} DAYS`;
 
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase();
}
 
function isDeadlineSoon(isoString) {
  if (!isoString) return false;
  const diffDays = Math.ceil((new Date(isoString) - new Date()) / (1000 * 60 * 60 * 24));
  return diffDays <= 7;
}
 
// ── GROUP labs ตาม subjectId ─────────────────────────────────
function groupBySubject(labs) {
  const map = {};
  labs.forEach(lab => {
    const sid = lab.subjectId || "Unknown";
    if (!map[sid]) map[sid] = [];
    map[sid].push(lab);
  });
  return map;
}
 
// ── คำนวณจำนวน labs ที่ due ภายใน 7 วัน ─────────────────────
function countLabsDueSoon(labs) {
  return labs.filter(lab => lab.status === "active" && isDeadlineSoon(lab.deadline)).length;
}
 
// ── RENDER summary cards (Active Classes + Labs Due) ─────────
function renderSummary(subjectCount, labsDueSoon) {
  // Active Classes
  const activeEl = document.querySelector(".stat-value");
  if (activeEl) activeEl.textContent = subjectCount;
 
  // Labs Due
  const actionEl = document.querySelector(".action-value");
  if (actionEl) {
    actionEl.innerHTML = `${labsDueSoon} <span class="stat-value-sm">Labs Due</span>`;
  }
}
 
// ── RENDER class cards ───────────────────────────────────────
function renderClassCards(grouped, allLabs) {
  const grid = document.getElementById("classesGrid");
  if (!grid) return;
 
  grid.innerHTML = "";
 
  const subjects = Object.keys(grouped);
 
  if (subjects.length === 0) {
    grid.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-secondary)">
        <p style="font-size:15px">No classes found.</p>
      </div>`;
    return;
  }
 
  subjects.forEach((subjectId, index) => {
    const labs = grouped[subjectId];
    const totalLabs = labs.length;
    const activeLabs = labs.filter(l => l.status === "active");
    const completedLabs = totalLabs - activeLabs.length;
    const progressPct = totalLabs > 0 ? Math.round((completedLabs / totalLabs) * 100) : 0;
 
    // หา lab ที่ due เร็วที่สุด
    const dueSoonLabs = activeLabs
      .filter(l => l.deadline && isDeadlineSoon(l.deadline))
      .sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
 
    const hasDue = dueSoonLabs.length > 0;
    const color = getCardColor(index);
 
    // Footer status
    let footerHTML;
    if (activeLabs.length === 0) {
      footerHTML = `
        <span class="footer-ok"><span class="dot dot-ok"></span>All caught up</span>
        <span class="footer-due-ok">0 PENDING</span>`;
    } else if (hasDue) {
      const deadlineLabel = formatDeadline(dueSoonLabs[0].deadline);
      const isOverdue = deadlineLabel === "OVERDUE";
      footerHTML = `
        <span class="footer-warn"><span class="dot dot-warn"></span>${dueSoonLabs.length} Lab${dueSoonLabs.length > 1 ? "s" : ""} Due</span>
        <span class="${isOverdue ? "footer-overdue" : "footer-due-warn"}">${deadlineLabel}</span>`;
    } else {
      footerHTML = `
        <span class="footer-warn"><span class="dot dot-warn"></span>${activeLabs.length} Pending</span>
        <span class="footer-due-date">UPCOMING</span>`;
    }
 
    const card = document.createElement("div");
    card.className = "class-card";
    card.dataset.name = subjectId.toLowerCase();
    card.dataset.subjectId = subjectId;
 
    card.innerHTML = `
      <div class="card-accent accent-${color}"></div>
      <div class="card-body">
        <div class="card-tag-row">
          <span class="card-tag tag-${color}">${subjectId}</span>
          <div class="card-arrow">→</div>
        </div>
        <div class="card-title">${labs[0]?.labName ? subjectId : subjectId}</div>
        <div class="card-sub">${totalLabs} Total Lab${totalLabs !== 1 ? "s" : ""}</div>
        <div class="progress-label">
          <span>Lab Progress</span>
          <span>${completedLabs}/${totalLabs}</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill fill-${color}" style="width:0%" data-width="${progressPct}%"></div>
        </div>
      </div>
      <div class="card-footer">${footerHTML}</div>`;
 
    // Click → ไปหน้า Lablist พร้อม subjectId
    card.addEventListener("click", () => {
      window.location.href = `student_Lablist.html?subjectId=${encodeURIComponent(subjectId)}`;
    });
 
    grid.appendChild(card);
  });
 
  // Animate progress bars
  setTimeout(() => {
    grid.querySelectorAll(".progress-fill").forEach(bar => {
      bar.style.width = bar.dataset.width;
    });
  }, 100);
}
 
// ── RENDER loading skeleton ──────────────────────────────────
function renderSkeleton() {
  const grid = document.getElementById("classesGrid");
  if (!grid) return;
 
  grid.innerHTML = Array(3).fill(`
    <div class="class-card" style="pointer-events:none">
      <div class="card-accent" style="background:#e2e8f0"></div>
      <div class="card-body">
        <div style="height:20px;width:60px;background:#f1f5f9;border-radius:4px;margin-bottom:12px"></div>
        <div style="height:18px;width:140px;background:#f1f5f9;border-radius:4px;margin-bottom:6px"></div>
        <div style="height:14px;width:80px;background:#f1f5f9;border-radius:4px;margin-bottom:16px"></div>
        <div style="height:5px;width:100%;background:#f1f5f9;border-radius:4px"></div>
      </div>
      <div class="card-footer" style="background:#fafafa"></div>
    </div>`).join("");
}
 
// ── RENDER error state ───────────────────────────────────────
function renderError(message) {
  const grid = document.getElementById("classesGrid");
  if (!grid) return;
 
  grid.innerHTML = `
    <div style="grid-column:1/-1;text-align:center;padding:40px">
      <div style="color:#dc2626;font-size:14px;margin-bottom:8px">⚠ Failed to load classes</div>
      <div style="color:var(--text-secondary);font-size:13px">${message}</div>
      <button onclick="loadDashboard()" style="margin-top:16px;padding:8px 20px;border:0.5px solid #e2e8f0;border-radius:6px;background:#fff;cursor:pointer;font-size:13px">
        Try again
      </button>
    </div>`;
}
 
// ── MAIN: โหลดข้อมูลจาก backend ─────────────────────────────
async function loadDashboard() {
  renderSkeleton();
 
  try {
    const res = await fetch(ENDPOINTS.labLister, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
 
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
 
    const data = await res.json();
 
    if (!data.success) throw new Error(data.error || "Unknown error from server");
 
    const labs = data.labs || [];
 
    // TODO: filter ด้วย studentId เมื่อมี auth
    // const studentId = getCurrentUserId();
    // const myLabs = labs.filter(l => l.sections?.includes(mySection));
 
    const grouped = groupBySubject(labs);
    const labsDueSoon = countLabsDueSoon(labs);
 
    renderSummary(Object.keys(grouped).length, labsDueSoon);
    renderClassCards(grouped, labs);
 
  } catch (err) {
    console.error("Dashboard load error:", err);
    renderError(err.message);
  }
}
 
// ── SEARCH/FILTER ────────────────────────────────────────────
function filterCards() {
  const q = document.getElementById("searchInput")?.value.toLowerCase() || "";
  document.querySelectorAll(".class-card").forEach(card => {
    const name = (card.dataset.name || "") + (card.dataset.subjectId || "");
    card.style.display = name.includes(q) ? "" : "none";
  });
}
 
// ── INIT ─────────────────────────────────────────────────────
window.addEventListener("load", loadDashboard);