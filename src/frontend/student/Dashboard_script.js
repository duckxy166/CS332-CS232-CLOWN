// 1. จำลองข้อมูลที่ได้จาก Database
const mockData = {
    user: { name: "Somchai TU" },
    courses: [
        {
            code: "CS 251",
            name: "Data Structures",
            labs: [
                { title: "Lab 1 : Array", section: "650002", due: "25/03/2026" },
                { title: "Lab 2 : Linked List", section: "650002", due: "01/04/2026" }
            ]
        },
        {
            code: "CS 232",
            name: "Algorithm Design",
            labs: [
                { title: "Lab 1 : Sorting", section: "650001", due: "22/03/2026" }
            ]
        }
    ],
    priority: [
        { code: "CS 251", title: "Lab 1 : Array", daysLeft: "1" },
        { code: "CS 232", title: "Lab 1 : Sorting", daysLeft: "3" }
    ]
};

// 2. ฟังก์ชันแสดงผล
function renderDashboard() {
    // แสดงชื่อผู้ใช้
    document.getElementById('user-name').innerText = mockData.user.name;

    // แสดง All Labs
    const labContainer = document.getElementById('lab-container');
    labContainer.innerHTML = mockData.courses.map(course => `
        <div class="lab-card">
            <div class="card-header"><span class="badge">${course.code}</span> | ${course.name}</div>
            ${course.labs.map(lab => `
                <div class="lab-item">
                    <strong>${lab.title}</strong>
                    <div class="lab-info-row">
                        <span>Section : ${lab.section}</span>
                        <span>Due : ${lab.due}</span>
                    </div>
                </div>
            `).join('')}
        </div>
    `).join('');

    // Priority To-do
    const todoContainer = document.getElementById('todo-container');
    todoContainer.innerHTML = mockData.priority.map(todo => `
        <div class="todo-item">
            <div>
                <span class="badge">${todo.code}</span>
                <div style="margin-top:5px;"><strong>${todo.title}</strong></div>
                <p class="deadline">เหลือเวลาอีก ${todo.daysLeft} วัน</p>
            </div>
            <span class="material-symbols-outlined">arrow_circle_right</span>
        </div>
    `).join('');
}

// รันฟังก์ชันเมื่อโหลดหน้า
window.onload = renderDashboard;
