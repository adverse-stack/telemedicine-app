document.addEventListener('DOMContentLoaded', () => {
    const socket = io();
    const findDoctorsBtn = document.getElementById('find-doctors-btn');
    const logoutBtn = document.getElementById('logout-btn');

    const patientId = localStorage.getItem('userId');
    if (patientId) {
        socket.emit('patient_joins', { patientId: patientId });
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
            localStorage.clear();
            window.location.href = 'login.html';
        });
    }
});
