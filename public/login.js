document.addEventListener('DOMContentLoaded', () => {
    const patientLoginForm = document.getElementById('patientLoginForm');
    const doctorLoginForm = document.getElementById('doctorLoginForm');
    const patientLoginError = document.getElementById('patientLoginError');
    const doctorLoginError = document.getElementById('doctorLoginError');

    const handleLogin = async (event, role, errorElement) => {
        event.preventDefault();
        errorElement.textContent = ''; // Clear previous errors

        const form = event.target;
        const username = form.querySelector('input[name="username"]').value;
        const password = form.querySelector('input[name="password"]').value;

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username: username, password: password, role: role }),
            });

            const data = await response.json();

            if (data.success) {
                const authenticatedRole = data.role || role;
                if (authenticatedRole === 'admin') {
                    window.location.href = 'admin.html';
                } else if (authenticatedRole === 'patient') {
                    window.location.href = 'patient-dashboard.html';
                } else if (authenticatedRole === 'doctor') {
                    window.location.href = 'doctor-dashboard.html';
                }
            } else {
                errorElement.textContent = data.message || 'Login failed. Please check your credentials.';
            }
        } catch (error) {
            console.error('Error during login:', error);
            errorElement.textContent = 'An unexpected error occurred. Please try again.';
        }
    };

    if (patientLoginForm) {
        patientLoginForm.addEventListener('submit', (event) => handleLogin(event, 'patient', patientLoginError));
    }

    if (doctorLoginForm) {
        doctorLoginForm.addEventListener('submit', (event) => handleLogin(event, 'doctor', doctorLoginError));
    }
});
