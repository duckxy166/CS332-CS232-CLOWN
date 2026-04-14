 /* ── Data ── */
const courses = [
  {
    code: "CS 232",
    name: "Computer Architecture",
    progress: 82,
    totalLabs: 12,
    sections: 4,
    pendingReviews: 5,
    status: "Action req",
    color: "indigo-500", // Tailwind color for the top bar
    lightColor: "indigo-50"
  },
  {
    code: "CS 251",
    name: "Data Structures",
    progress: 45,
    totalLabs: 8,
    sections: 2,
    pendingReviews: 7,
    status: "Action req",
    color: "blue-500",
    lightColor: "blue-50"
  },
  {
    code: "CS 271",
    name: "Operating Systems",
    progress: 100,
    totalLabs: 4,
    sections: 3,
    pendingReviews: 0,
    status: "0 Pending",
    color: "emerald-500",
    lightColor: "emerald-50"
  }
];

/* ── Render ── */
function renderGrid(filter = "") {
  const grid = document.getElementById("labGrid");
  const q = filter.toLowerCase();

  const filtered = courses.filter(c =>
    c.code.toLowerCase().includes(q) ||
    c.name.toLowerCase().includes(q)
  );

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full py-12 flex flex-col items-center justify-center text-gray-500 bg-layout-surface rounded-xl border border-layout-border border-dashed">
        <i class="ph-fill ph-magnifying-glass text-4xl mb-2 text-gray-300"></i>
        <p class="text-p1 font-semibold">No classes found</p>
      </div>`;
    return;
  }

  grid.innerHTML = filtered.map((c, i) => {
    const isComplete = c.progress === 100;
    const progressTextColor = isComplete ? 'text-emerald-500' : 'text-brand-800';
    return `
    <div class="bg-layout-surface rounded-xl border border-layout-border shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow">
      
      <!-- Top Color Bar -->
      <div class="h-1.5 w-full bg-${c.color}"></div>
      
      <div class="p-5 flex-1 flex flex-col">
        <!-- Header -->
        <div class="flex justify-between items-start mb-3">
            <span class="bg-${c.lightColor} text-${c.color} text-xs font-bold px-2.5 py-1 rounded border border-${c.color} border-opacity-20">${c.code}</span>
            <button class="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-300 hover:bg-gray-200 transition-colors">
                <i class="ph ph-arrow-right text-sm"></i>
            </button>
        </div>
        
        <!-- Course Name -->
        <h3 class="text-h3 text-brand-800 mb-4">${c.name}</h3>
        
        <!-- Progress -->
        <div class="mb-5">
            <div class="flex justify-between items-end mb-1.5">
                <span class="text-p2 text-gray-400 font-semibold">Grading Progress</span>
                <span class="text-p2 font-bold ${progressTextColor}">${c.progress}%</span>
            </div>
            <div class="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div class="h-full bg-${c.color} rounded-full" style="width: ${c.progress}%"></div>
            </div>
        </div>
        
        <!-- Stats Grid -->
        <div class="grid grid-cols-2 gap-0 mb-5 border border-gray-100 rounded-lg overflow-hidden">
            <div class="p-3 border-r border-gray-100">
                <div class="text-xs text-gray-400 font-semibold flex items-center gap-1 mb-1">
                    <i class="ph-fill ph-folder"></i> Total Labs
                </div>
                <div class="text-h3 text-brand-800">${c.totalLabs}</div>
            </div>
            <div class="p-3">
                <div class="text-xs text-gray-400 font-semibold flex items-center gap-1 mb-1">
                    <i class="ph-fill ph-users"></i> Sections
                </div>
                <div class="text-h3 text-brand-800">${c.sections}</div>
            </div>
        </div>
        
        <!-- Pending Status Alert -->
        ${c.pendingReviews > 0 ? `
            <div class="bg-amber-50 rounded-lg p-3 flex justify-between items-center mb-4">
                <div class="flex items-center gap-2 text-amber-500 font-bold text-p1">
                    <div class="w-2 h-2 rounded-full bg-amber-500"></div>
                    ${c.pendingReviews} Pending Reviews
                </div>
                <span class="text-xs text-amber-500 font-bold tracking-wider uppercase">Action req</span>
            </div>
        ` : `
            <div class="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex justify-between items-center mb-4">
                <div class="flex items-center gap-2 text-emerald-500 font-bold text-p1">
                    <i class="ph-fill ph-check-circle"></i>
                    All caught up
                </div>
                <span class="text-xs text-emerald-500 font-bold tracking-wider">0 Pending</span>
            </div>
        `}
        
        <!-- Spacer -->
        <div class="flex-1"></div>
        
        <!-- Divider -->
        <div class="border-t border-gray-100 -mx-5"></div>
        
        <!-- Add New Lab Button -->
        <button class="w-full pt-3 flex items-center justify-center gap-2 text-gray-500 hover:text-brand-800 font-semibold transition-colors text-p1" onclick="addLab(${i})">
            <i class="ph ph-plus-circle text-lg"></i> Add New Lab
        </button>
      </div>
    </div>
  `;
  }).join("");
}

/* ── Add Lab (demo) ── */
function addLab(idx) {
  courses[idx].totalLabs += 1;
  courses[idx].progress = Math.max(0, courses[idx].progress - 10); // arbitrary demo logic
  renderGrid(document.getElementById("searchInput").value);
}

/* ── Search ── */
document.getElementById("searchInput").addEventListener("input", e => {
  renderGrid(e.target.value);
});

/* ── Init ── */
renderGrid();