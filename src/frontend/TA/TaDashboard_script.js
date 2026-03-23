 /* ── Data ── */
  const courses = [
    {
      code: "CS 251",
      name: "xxxxxxx",
      labs: [
        { name: "Lab 1 : xxxx", section: "650002", due: "xx/xx/xxxx" },
        { name: "Lab 2 : xxxx", section: "650002", due: "xx/xx/xxxx" },
      ]
    },
    {
      code: "CS 232",
      name: "xxxxxxx",
      labs: [
        { name: "Lab 1 : xxxx", section: "650001", due: "xx/xx/xxxx" },
        { name: "Lab 2 : xxxx", section: "650001", due: "xx/xx/xxxx" },
        { name: "Lab 3 : xxxx", section: "650001", due: "xx/xx/xxxx" },
      ]
    },
    {
      code: "CS 262",
      name: "xxxxxxx",
      labs: [
        { name: "Lab 1 : xxxx", section: "650001", due: "xx/xx/xxxx" },
        { name: "Lab 2 : xxxx", section: "650001", due: "xx/xx/xxxx" },
      ]
    },
    {
      code: "CS 271",
      name: "xxxxxxx",
      labs: [
        { name: "Lab 1 : xxxx", section: "650002", due: "xx/xx/xxxx" },
        { name: "Lab 2 : xxxx", section: "650002", due: "xx/xx/xxxx" },
        { name: "Lab 3 : xxxx", section: "650002", due: "xx/xx/xxxx" },
      ]
    },
  ];
 
  /* ── Render ── */
  function renderGrid(filter = "") {
    const grid = document.getElementById("labGrid");
    const q = filter.toLowerCase();
 
    const filtered = courses.filter(c =>
      c.code.toLowerCase().includes(q) ||
      c.name.toLowerCase().includes(q) ||
      c.labs.some(l => l.name.toLowerCase().includes(q))
    );
 
    if (filtered.length === 0) {
      grid.innerHTML = `
        <div class="empty-state">
          <div class="emoji">🔍</div>
          ไม่พบรายการที่ค้นหา
        </div>`;
      return;
    }
 
    grid.innerHTML = filtered.map((c, i) => `
      <div class="card" style="animation-delay:${i * 0.06}s">
        <div class="card-header">
          <span class="course-tag">${c.code}</span>
          <span class="course-name">| ${c.name}</span>
          <button class="add-btn" title="Add Lab" onclick="addLab(${courses.indexOf(c)})">+</button>
        </div>
        ${c.labs.map((l, j) => `
          <div class="lab-item">
            <div class="lab-name">${l.name}</div>
            <div class="lab-meta">
              <span>Section : ${l.section}</span>
              <span>Due : ${l.due}</span>
            </div>
          </div>
        `).join("")}
      </div>
    `).join("");
  }
 
  /* ── Add Lab (demo) ── */
  function addLab(idx) {
    const n = courses[idx].labs.length + 1;
    courses[idx].labs.push({
      name: `Lab ${n} : xxxx`,
      section: courses[idx].labs[0].section,
      due: "xx/xx/xxxx"
    });
    renderGrid(document.getElementById("searchInput").value);
  }
 
  /* ── Search ── */
  document.getElementById("searchInput").addEventListener("input", e => {
    renderGrid(e.target.value);
  });
 
  /* ── Init ── */
  renderGrid();