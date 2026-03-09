const userData = localStorage.getItem('user');

if (!userData) {
    window.location.href = 'login.html';
} else {
    const user = JSON.parse(userData);
    document.getElementById('userDisplay').innerText = "ผู้ใช้งาน: " + (user.displayname_en || user.username);
}

function logout() {
    localStorage.removeItem('user');
    window.location.href = 'login.html';
}
