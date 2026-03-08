document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const messageDiv = document.getElementById('message');

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const applicationKey = 'TU7ba945dfd7eab36cb292085fe2193cf101b2cb94388c2721d105e34eb6df0a7378f327eddfbee7820e251535fbb12593';

        messageDiv.textContent = 'Logging in...';
        messageDiv.style.color = '#333';

        try {
            const response = await fetch('https://restapi.tu.ac.th/api/v1/auth/Ad/verify', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Application-Key': applicationKey
                },
                body: JSON.stringify({
                    UserName: username,
                    PassWord: password
                })
            });

            const data = await response.json();

            // Status 200 with status: true means success
            if (response.ok && data.status) {
                console.log('Login successful data:', data);
                messageDiv.textContent = 'Login successful! Welcome, ' + (data.displayname_en || data.username);
                messageDiv.style.color = 'green';

                // Example of redirecting and storing user data
                // localStorage.setItem('user', JSON.stringify(data));
                // setTimeout(() => {
                //     window.location.href = 'index.html';
                // }, 1000);
            } else {
                // API returned 400 Bad Request or status: false
                console.error('Login failed data:', data);
                messageDiv.textContent = 'Login failed: ' + (data.message || 'Invalid username or password');
                messageDiv.style.color = 'red';
            }
        } catch (error) {
            console.error('Error during login fetch:', error);
            messageDiv.textContent = 'An error occurred during login. Please check your connection and try again.';
            messageDiv.style.color = 'red';
        }
    });
});
