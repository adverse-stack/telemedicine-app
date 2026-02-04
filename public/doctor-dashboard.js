document.addEventListener('DOMContentLoaded', () => {
    const socket = io();
    const patientList = document.getElementById('patient-list');
    const logoutBtn = document.getElementById('logout-btn');

    const doctorId = localStorage.getItem('userId'); // Changed to localStorage
    console.log(`Doctor Dashboard loaded. Doctor ID from localStorage: ${doctorId}`);

    if (doctorId) {
        // Announce that doctor is online
        socket.emit('doctor_joins', { userId: doctorId });
    }

    // Fetch patients who have conversations with the doctor
    const fetchPatients = async () => {
        console.log('Fetching patients for doctor:', doctorId);
        try {
            const response = await fetch(`/api/doctor/patients?doctorId=${doctorId}`);
            const patients = await response.json();
            console.log('Received patients from API:', patients);

            patientList.innerHTML = ''; // Clear previous list
            if (patients.length > 0) {
                patients.forEach(patient => {
                    const li = document.createElement('li');
                    li.className = 'custom-list-item'; // Changed class
                    li.innerHTML = `
                        <span>${patient.username}
                        <span class="online-status online"></span></span>
                        <button class="button-1" data-patient-id="${patient.id}" data-patient-name="${patient.username}">Chat</button>
                    `;
                    patientList.appendChild(li);
                });

                // Add event listeners to the new "Chat" buttons
                patientList.querySelectorAll('.button-1').forEach(button => { // Changed query selector
                    button.addEventListener('click', (e) => {
                        const patientId = e.target.getAttribute('data-patient-id');
                        const patientName = e.target.getAttribute('data-patient-name');
                        const doctorId = localStorage.getItem('userId'); // Changed to localStorage
                        
                        // Emit event to server that doctor accepts consultation
                        socket.emit('doctor_accepts_consultation', { patientId: Number(patientId), doctorId: Number(doctorId), doctorName: localStorage.getItem('username') });

                        // Redirect doctor to message page
                        window.location.href = `/message.html?patientId=${patientId}&patientName=${patientName}&doctorId=${doctorId}`;
                    });
                });

            } else {
                patientList.innerHTML = '<li class="custom-list-item placeholder">No patients have started a conversation yet.</li>'; // Changed class
            }
        } catch (error) {
            console.error('Failed to fetch patients:', error);
            patientList.innerHTML = '<li class="custom-list-item error-message">Failed to load patients.</li>';
        }
    };

    if (doctorId) {
        fetchPatients();
    }

    socket.on('new_patient', (patient) => {
        console.log('Received new_patient event:', patient);
        fetchPatients();
    });

    logoutBtn.addEventListener('click', () => {
        localStorage.clear(); // Changed to localStorage
        window.location.href = 'login.html'; // Changed redirect target
    });
});