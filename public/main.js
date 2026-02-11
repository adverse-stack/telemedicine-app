// This script handles dashboard interactions, primarily for admin doctor management.

document.addEventListener('DOMContentLoaded', () => {
    const addDoctorForm = document.getElementById('add-doctor-form');
    const doctorsTableBody = document.getElementById('doctors-table-body');
    const doctorsListMessage = document.getElementById('doctors-list-message');


    // Function to fetch and display doctors
    const fetchDoctors = async () => {
        if (!doctorsTableBody) return; // Only run on admin page if doctorsTableBody exists

        try {
            const response = await fetch('/api/admin/doctors');
            if (!response.ok) {
                // If not authenticated or authorized, server will return 401/403
                console.error('Failed to fetch doctors: Authentication or authorization failed.');
                // Redirect to login if unauthorized, though server should handle this via HttpOnly cookie
                window.location.href = 'login.html'; 
                return;
            }
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

    // Call fetchDoctors on admin page load, as determined by the presence of relevant elements
    if (doctorsTableBody && addDoctorForm) { // Assuming these elements are unique to admin.html
        fetchDoctors();
    }
});
