document.addEventListener('DOMContentLoaded', () => {
    // Redirect if already logged in
    if (localStorage.getItem('token')) {
        window.location.href = '/pages/dashboard.html';
    }

    const loginForm = document.getElementById('loginForm');
    const errorMessage = document.getElementById('errorMessage');

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const submitBtn = loginForm.querySelector('button[type="submit"]');

        try {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Signing in...';
            errorMessage.classList.add('hidden');

            const data = await window.API.login(email, password);
            
            // Save to localStorage
            localStorage.setItem('token', data.token);
            
            // Підтримка формату { token, user: {...} } згідно з API
            const userData = data.user || data;
            localStorage.setItem('user', JSON.stringify({
                id: userData._id || userData.id,
                fullName: userData.fullName,
                email: userData.email,
                role: userData.role,
                department: userData.department
            }));

            // Log the login action for System Audit
            try {
                await window.API.fetchAPI('/users/system/audit/login', 'POST');
            } catch (auditError) {
                console.error('Failed to log login action', auditError);
            }

            // Redirect based on role
            if (userData.role === 'admin') {
                window.location.href = '/pages/users.html';
            } else {
                window.location.href = '/pages/dashboard.html';
            }
        } catch (error) {
            errorMessage.textContent = error.message;
            errorMessage.classList.remove('hidden');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Sign In';
        }
    });
});
