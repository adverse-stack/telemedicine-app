// This script handles login, redirection, and dashboard interactions.

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const addDoctorForm = document.getElementById('add-doctor-form');
    const findDoctorsBtn = document.getElementById('find-doctors-btn');
    const logoutBtn = document.getElementById('logout-btn');

    // Handle Login
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const role = document.getElementById('role').value;
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            const errorMessage = document.getElementById('error-message');

            try {
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ role, username, password }),
                });

                const data = await response.json();

                if (response.ok) {
                    // Store user info in session storage
                    sessionStorage.setItem('userRole', role);
                    sessionStorage.setItem('userId', data.userId);
                    sessionStorage.setItem('username', username);

                    // Redirect based on role
                    window.location.href = `/${role.slice(0, -1)}.html`;
                } else {
                    errorMessage.textContent = data.message;
                    errorMessage.classList.remove('d-none');
                }
            } catch (error) {
                errorMessage.textContent = 'An error occurred. Please try again.';
                errorMessage.classList.remove('d-none');
            }
        });
    }

    const registerButton = document.getElementById('registerButton');

    // Handle Registration
    if (registerButton) {
        registerButton.addEventListener('click', async () => {
            const username = document.getElementById('registerUsername').value;
            const password = document.getElementById('registerPassword').value;
            const registerMessage = document.getElementById('registerMessage');

            try {
                const response = await fetch('/api/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password }),
                });

                const data = await response.json();

                if (response.ok) {
                    registerMessage.textContent = 'Registration successful! You can now log in.';
                    registerMessage.className = 'alert alert-success';
                } else {
                    registerMessage.textContent = data.message;
                    registerMessage.className = 'alert alert-danger';
                }
            } catch (error) {
                registerMessage.textContent = 'An error occurred. Please try again.';
                registerMessage.className = 'alert alert-danger';
            }
        });
    }

    // Handle Admin: Add Doctor
    if (addDoctorForm) {
        addDoctorForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('doc-username').value;
            const password = document.getElementById('doc-password').value;
            const profession = document.getElementById('doc-profession').value;
            const adminMessage = document.getElementById('admin-message');

            try {
                const response = await fetch('/api/admin/doctors', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password, profession }),
                });

                const data = await response.json();
                adminMessage.textContent = data.message;
                adminMessage.classList.remove('d-none', 'alert-danger');
                adminMessage.classList.add('alert-success');
                addDoctorForm.reset();
            } catch (error) {
                adminMessage.textContent = 'Failed to add doctor.';
                adminMessage.classList.remove('d-none', 'alert-success');
                adminMessage.classList.add('alert-danger');
            }
        });
    }

    // Handle Patient: Find Doctors
    if (findDoctorsBtn) {
        findDoctorsBtn.addEventListener('click', async () => {
            const profession = document.getElementById('profession').value;
            const doctorListContainer = document.getElementById('doctor-list-container');
            const doctorList = document.getElementById('doctor-list');

            try {
                const response = await fetch(`/api/doctors?profession=${profession}`);
                const doctors = await response.json();

                doctorList.innerHTML = ''; // Clear previous list
                if (doctors.length > 0) {
                    doctors.forEach(doctor => {
                        const li = document.createElement('li');
                        li.className = 'list-group-item d-flex justify-content-between align-items-center';
                        li.innerHTML = `
                            ${doctor.username} - ${doctor.profession}
                            <button class="btn btn-sm btn-primary" data-doctor-id="${doctor.id}" data-doctor-name="${doctor.username}">Consult</button>
                        `;
                        doctorList.appendChild(li);
                    });
                     // Add event listeners to the new "Consult" buttons
                    doctorList.querySelectorAll('.btn-primary').forEach(button => {
                        button.addEventListener('click', (e) => {
                            const doctorId = e.target.getAttribute('data-doctor-id');
                            const doctorName = e.target.getAttribute('data-doctor-name');
                            sessionStorage.setItem('selectedDoctorId', doctorId);
                            // Hide selection and show consultation room
                            document.getElementById('profession-selection').classList.add('d-none');
                            document.getElementById('doctor-list-container').classList.add('d-none');
                            const consultationRoom = document.getElementById('consultation-room');
                            consultationRoom.classList.remove('d-none');
                            consultationRoom.querySelector('h4.card-title').textContent = `Consultation with ${doctorName}`;
                            
                            // Initialize chat/video
                            if (window.initChatAndVideo) {
                                window.initChatAndVideo(doctorId);
                            }
                        });
                    });

                } else {
                    doctorList.innerHTML = '<li class="list-group-item">No doctors found for this specialty.</li>';
                }
                doctorListContainer.classList.remove('d-none');
            } catch (error) {
                console.error('Failed to fetch doctors:', error);
            }
        });
    }

    // Handle Logout
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            sessionStorage.clear();
            window.location.href = '/';
        });
    }

    // Basic session check
    const protectedPages = ['/admin.html', '/doctor.html', '/patient.html'];
    if (protectedPages.includes(window.location.pathname)) {
        const userRole = sessionStorage.getItem('userRole');
        if (!userRole || !window.location.pathname.startsWith(`/${userRole.slice(0, -1)}`)) {
             // window.location.href = '/';
        }
    }
});
