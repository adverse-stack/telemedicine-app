document.addEventListener('DOMContentLoaded', () => {
    const signupForm = document.getElementById('signupForm');
    const signupError = document.getElementById('signupError');

    const handleSignup = async (event) => {
        event.preventDefault();
        signupError.textContent = ''; // Clear previous errors

        const form = event.target;
        const username = form.querySelector('input[name="username"]').value;
        const password = form.querySelector('input[name="password"]').value;

        try {
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username: username, password: password }),
            });

            const data = await response.json();

            if (data.success) {
                // Redirect to login page after successful registration
                window.location.href = 'login.html';
            } else {
                signupError.textContent = data.message || 'Registration failed. Please try again.';
            }
        } catch (error) {
            console.error('Error during registration:', error);
            signupError.textContent = 'An unexpected error occurred. Please try again.';
        }
    };

    if (signupForm) {
        signupForm.addEventListener('submit', handleSignup);
    }
});
