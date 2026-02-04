document.addEventListener('DOMContentLoaded', () => {
    const adminLoginForm = document.getElementById('adminLoginForm');
    const adminLoginError = document.getElementById('adminLoginError');

    const handleAdminLogin = async (event) => {
        event.preventDefault();
        adminLoginError.textContent = ''; // Clear previous errors

        const form = event.target;
        const email = form.querySelector('input[name="email"]').value;
        const password = form.querySelector('input[name="password"]').value;

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username: email, password: password, role: 'admin' }),
            });

            const data = await response.json();

            if (data.success) {
                localStorage.setItem('userId', data.userId);
                localStorage.setItem('userRole', data.role);
                localStorage.setItem('username', email); // Store username for display
                window.location.href = 'admin.html'; // Assuming admin.html is the admin dashboard
            } else {
                adminLoginError.textContent = data.message || 'Admin login failed. Please check your credentials.';
            }
        } catch (error) {
            console.error('Error during admin login:', error);
            adminLoginError.textContent = 'An unexpected error occurred. Please try again.';
        }
    };

    if (adminLoginForm) {
        adminLoginForm.addEventListener('submit', handleAdminLogin);
    }
});
