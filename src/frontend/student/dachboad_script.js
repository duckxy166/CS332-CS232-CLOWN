
 
// ── CONFIG ─────
const BASE_URL = 'https://xxxxxxxx.execute-api.ap-southeast-1.amazonaws.com/prod';
const USER_ID  = localStorage.getItem('user_id') || 'U001'; // fallback สำหรับทดสอบ
 
// ── MOCK DATA (ลบออกเมื่อใช้ API จริง) ───────
const MOCK_USER = { full_name: 'Name : xxxxx' };
 
const MOCK_COURSES = [
  {
    course_id:   'CS 251',
    course_name: 'Data Structures',
    section:     '650002',
    labs: [
      { lab_id: 1, title: 'Lab 1 : Linked List',   due_date: '20/03/2026' },
      { lab_id: 2, title: 'Lab 2 : Stack & Queue',  due_date: '27/03/2026' }
    ]
  },
  {
    course_id:   'CS 232',
    course_name: 'Algorithm Design',
    section:     '650001',
    labs: [
      { lab_id: 1, title: 'Lab 1 : Sorting',        due_date: '22/03/2026' },
      { lab_id: 2, title: 'Lab 2 : Binary Search',   due_date: '29/03/2026' },
      { lab_id: 3, title: 'Lab 3 : Graph BFS/DFS',   due_date: '05/04/2026' }
    ]
  },
  {
    course_id:   'CS 271',
    course_name: 'Database Systems',
    section:     '650002',
    labs: [
      { lab_id: 1, title: 'Lab 1 : ER Diagram',     due_date: '25/03/2026' },
      { lab_id: 2, title: 'Lab 2 : SQL Query',       due_date: '01/04/2026' },
      { lab_id: 3, title: 'Lab 3 : Normalization',   due_date: '08/04/2026' }
    ]
  },
  {
    course_id:   'CS 262',
    course_name: 'Operating Systems',
    section:     '650001',
    labs: [
      { lab_id: 1, title: 'Lab 1 : Process & Thread',   due_date: '24/03/2026' },
      { lab_id: 2, title: 'Lab 2 : Memory Management',  due_date: '31/03/2026' }
    ]
  }
];
 
const MOCK_PRIORITY = [
  { course_id: 'CS 251', title: 'Lab 1 : Linked List',      days_left: 1 },
  { course_id: 'CS 232', title: 'Lab 1 : Sorting',           days_left: 3 },
  { course_id: 'CS 262', title: 'Lab 1 : Process & Thread',  days_left: 5 }
];
 
// ── RENDER : ชื่อ User (Navbar) ────────
function renderUserName(user) {
  document.getElementById('user-name').textContent = user.full_name;
}
 
// ── RENDER : All Lab ─────────────────
function renderLabs(courses) {
  const grid = document.getElementById('lab-grid');
 
  if (!courses.length) {
    grid.innerHTML = '<p style="color:#aaa;font-size:0.9rem;padding:12px 4px">ไม่พบ Lab ที่ค้นหา</p>';
    return;
  }
 
  grid.innerHTML = courses.map(course => `
    <div class="lab-card">
      <div class="card-header">
        <span class="course-badge">${course.course_id}</span>
        <span class="course-name">| ${course.course_name}</span>
      </div>
      ${course.labs.map((lab, i) => `
        ${i > 0 ? '<hr class="lab-divider"/>' : ''}
        <div class="lab-item">
          <div class="lab-title">${lab.title}</div>
          <div class="lab-meta">
            <span>Section : ${course.section}</span>
            <span class="lab-due">Due : ${lab.due_date}</span>
          </div>
        </div>
      `).join('')}
    </div>
  `).join('');
}
 
// ── RENDER : Priority To-do ───────────────
function renderPriority(items) {
  const box = document.getElementById('priority-list');
 
  if (!items.length) {
    box.innerHTML = '<p style="color:#aaa;font-size:0.9rem;padding:12px 4px">ไม่มี Lab ที่ใกล้ครบกำหนด</p>';
    return;
  }
 
  box.innerHTML = items.map((item, i) => `
    ${i > 0 ? '<hr class="lab-divider light"/>' : ''}
    <div class="priority-item">
      <div class="priority-content">
        <span class="course-badge small">${item.course_id}</span>
        <div class="lab-title">${item.title}</div>
        <div class="due-urgent${item.days_left <= 1 ? ' blink' : ''}">
          เหลือเวลาอีก ${item.days_left} วัน
        </div>
      </div>
      <button class="arrow-btn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 8 16 12 12 16"/>
          <line x1="8" y1="12" x2="16" y2="12"/>
        </svg>
      </button>
    </div>
  `).join('');
}
 
// ── SEARCH FILTER ───────
document.getElementById('search-input').addEventListener('input', function () {
  const q = this.value.toLowerCase().trim();
  const filtered = MOCK_COURSES.filter(c =>
    c.course_id.toLowerCase().includes(q) ||
    c.course_name.toLowerCase().includes(q) ||
    c.labs.some(l => l.title.toLowerCase().includes(q))
  );
  renderLabs(filtered);
});
 
// ── INIT ──────────────
// ใช้ Mock data ตอนนี้
// เมื่อพร้อม API จริง ให้ใช้ loadAll() แทน
renderUserName(MOCK_USER);
renderLabs(MOCK_COURSES);
renderPriority(MOCK_PRIORITY);
 
/*
// ── API จริง (เปิดใช้เมื่อมี Backend) ──────────
async function loadAll() {
  await Promise.all([loadUserName(), loadLabs(), loadPriority()]);
}
 
async function loadUserName() {
  const res  = await fetch(`${BASE_URL}/user?user_id=${USER_ID}`);
  const data = await res.json();
  renderUserName(data);
}
 
async function loadLabs() {
  const res     = await fetch(`${BASE_URL}/courses?user_id=${USER_ID}`);
  const courses = await res.json();
  renderLabs(courses);
}
 
async function loadPriority() {
  const res   = await fetch(`${BASE_URL}/priority?user_id=${USER_ID}`);
  const items = await res.json();
  renderPriority(items);
}
 
loadAll();
*/