// This script handles login, redirection, and dashboard interactions.

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const addDoctorForm = document.getElementById('add-doctor-form');
    const findDoctorsBtn = document.getElementById('find-doctors-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const doctorsTableBody = document.getElementById('doctors-table-body');
    const doctorsListMessage = document.getElementById('doctors-list-message');


    // Function to fetch and display doctors
    const fetchDoctors = async () => {
        if (!doctorsTableBody) return; // Only run on admin page

        try {
            const response = await fetch('/api/admin/doctors');
            const doctors = await response.json();

            doctorsTableBody.innerHTML = ''; // Clear existing list
            if (doctors.length > 0) {
                doctors.forEach(doctor => {
                    const row = doctorsTableBody.insertRow();
                    row.innerHTML = `
                        <td>${doctor.id}</td>
                        <td>${doctor.username}</td>
                        <td>${doctor.profession}</td>
                        <td><button class="btn btn-danger btn-sm delete-doctor-btn" data-doctor-id="${doctor.id}">Delete</button></td>
                    `;
                });
                // Add event listeners to delete buttons
                doctorsTableBody.querySelectorAll('.delete-doctor-btn').forEach(button => {
                    button.addEventListener('click', deleteDoctor);
                });
                doctorsListMessage.classList.add('d-none');
            } else {
                doctorsListMessage.textContent = 'No doctors found.';
                doctorsListMessage.classList.remove('d-none');
                doctorsListMessage.classList.remove('alert-success', 'alert-danger');
                doctorsListMessage.classList.add('alert-info');
            }
        } catch (error) {
            console.error('Failed to fetch doctors:', error);
            doctorsListMessage.textContent = 'Failed to load doctors.';
            doctorsListMessage.classList.remove('d-none', 'alert-success');
            doctorsListMessage.classList.add('alert-danger');
        }
    };

    // Function to delete a doctor
    const deleteDoctor = async (e) => {
        const doctorId = e.target.getAttribute('data-doctor-id');
        if (!confirm('Are you sure you want to delete this doctor?')) {
            return;
        }

        try {
            const response = await fetch(`/api/admin/doctors/${doctorId}`, {
                method: 'DELETE',
            });
            const data = await response.json();

            if (response.ok) {
                alert(data.message);
                fetchDoctors(); // Refresh the list
            } else {
                alert(data.message);
            }
        } catch (error) {
            console.error('Failed to delete doctor:', error);
            alert('Failed to delete doctor.');
        }
    };


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
                    if (role === 'doctors') {
                        window.location.href = '/doctor-dashboard.html';
                    } else {
                        window.location.href = `/${role.slice(0, -1)}.html`;
                    }
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
                if (response.ok) {
                    adminMessage.textContent = data.message;
                    adminMessage.classList.remove('d-none', 'alert-danger');
                    adminMessage.classList.add('alert-success');
                    addDoctorForm.reset();
                    fetchDoctors(); // Refresh the list after adding a doctor
                } else {
                    adminMessage.textContent = data.message;
                    adminMessage.classList.remove('d-none', 'alert-success');
                    adminMessage.classList.add('alert-danger');
                }
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
                        li.className = 'custom-list-item'; // Changed class
                        li.innerHTML = `
                            <span>${doctor.username} - ${doctor.profession}</span>
                            <button class="button-1" data-doctor-id="${doctor.id}" data-doctor-name="${doctor.username}">Consult</button>
                        `;
                        doctorList.appendChild(li);
                    });
                     // Add event listeners to the new "Consult" buttons
                    doctorList.querySelectorAll('.button-1').forEach(button => { // Changed query selector
                        button.addEventListener('click', async (e) => {
                            const doctorId = Number(e.target.getAttribute('data-doctor-id')); // Cast to Number
                            const doctorName = e.target.getAttribute('data-doctor-name');
                            const patientId = Number(localStorage.getItem('userId')); // Cast to Number

                            try {
                                await fetch('/api/start-conversation', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ patientId, doctorId }), // Sending numbers
                                });
                            } catch (error) {
                                console.error('Failed to start conversation:', error);
                            }
                            
                            localStorage.setItem('selectedDoctorId', doctorId); // Changed to localStorage
                            // Redirect to the waiting room page
                            window.location.href = `/waiting-room.html?doctorId=${doctorId}&doctorName=${doctorName}`;
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
    const protectedPages = ['/admin.html', '/doctor-dashboard.html', '/patient.html']; // Adjusted for specific dashboard pages
    if (protectedPages.includes(window.location.pathname)) {
        const userRole = localStorage.getItem('userRole'); // Use localStorage
        // If not logged in or role doesn't match page, redirect to login
        if (!userRole || 
            (window.location.pathname === '/patient.html' && userRole !== 'patient') ||
            (window.location.pathname === '/doctor-dashboard.html' && userRole !== 'doctor') ||
            (window.location.pathname === '/admin.html' && userRole !== 'admin')
        ) {
             window.location.href = 'login.html'; // Redirect to login.html
        }

        // Specific to admin page: fetch doctors on load
        if (window.location.pathname === '/admin.html') {
            fetchDoctors();
        }
    }

});
