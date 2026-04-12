let labs = [
    { id: 101, name: "Lab 01 - Introduction", section: "650001", total: 65, submitted: 40 },
    { id: 102, name: "Upload Image Layout", section: "650001", total: 65, submitted: 50 },
    { id: 103, name: "IAM - Identity Access", section: "650002", total: 65, submitted: 60 }
];

function renderLabs(data = labs) {
    const list = document.getElementById('labList');
    const count = document.getElementById('count-num');
    if(!list) return;

    count.innerText = data.length;
    list.innerHTML = '';

    data.forEach(lab => {
        const pending = lab.total - lab.submitted;
        const card = document.createElement('div');
        card.className = 'lab-card';
        card.innerHTML = `
            <div class="icon-box">
                <i class="ph ph-file-text text-xl text-slate-400"></i>
            </div>
            <div>
                <h4 class="lab-name-text">${lab.name}</h4>
                <div class="tag-section">
                    <i class="ph ph-users-three"></i> Section ${lab.section}
                </div>
            </div>
            <div class="stat-group">
                <p class="stat-tag">Pending</p>
                <p class="stat-number num-pending">${pending}</p>
            </div>
            <div class="stat-group">
                <p class="stat-tag">Submitted</p>
                <p class="stat-number">${lab.submitted}<span class="num-total">/${lab.total}</span></p>
            </div>
            <button class="btn-dl-all" onclick="alert('Downloading...')">
                <i class="ph ph-download-simple"></i> Download All
            </button>
            <div class="more-wrapper">
                <button class="btn-more" onclick="toggleMenu(event, ${lab.id})">
                    <i class="ph-fill ph-dots-three-outline-vertical text-xl"></i>
                </button>
                <div id="menu-${lab.id}" class="drop-menu">
                    <button class="btn-del" onclick="removeLab(${lab.id})">
                        <i class="ph ph-trash"></i> Delete Lab
                    </button>
                </div>
            </div>
        `;
        list.appendChild(card);
    });
}

function toggleMenu(e, id) {
    e.stopPropagation();
    const menu = document.getElementById(`menu-${id}`);
    document.querySelectorAll('.drop-menu').forEach(m => {
        if(m.id !== `menu-${id}`) m.classList.remove('show');
    });
    menu.classList.toggle('show');
}

function removeLab(id) {
    if(confirm('Are you sure you want to delete this lab?')) {
        labs = labs.filter(l => l.id !== id);
        renderLabs();
    }
}

function searchLabs() {
    const q = document.getElementById('labSearch').value.toLowerCase();
    const filtered = labs.filter(l => l.name.toLowerCase().includes(q) || l.section.includes(q));
    renderLabs(filtered);
}

// คลิกที่อื่นเพื่อปิดเมนู
window.onclick = () => document.querySelectorAll('.drop-menu').forEach(m => m.classList.remove('show'));

// โหลดครั้งแรก
document.addEventListener('DOMContentLoaded', () => renderLabs());