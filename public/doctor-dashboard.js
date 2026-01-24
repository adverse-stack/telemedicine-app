document.addEventListener('DOMContentLoaded', () => {
    const socket = io();
    const patientList = document.getElementById('patient-list');
    const logoutBtn = document.getElementById('logout-btn');

    const doctorId = sessionStorage.getItem('userId');

    if (doctorId) {
        // Announce that doctor is online
        socket.emit('doctor_joins', { userId: doctorId });
    }

    // Fetch patients who have conversations with the doctor
    const fetchPatients = async () => {
        try {
            const response = await fetch(`/api/doctor/patients?doctorId=${doctorId}`);
            const patients = await response.json();

            patientList.innerHTML = ''; // Clear previous list
            if (patients.length > 0) {
                patients.forEach(patient => {
                    const li = document.createElement('li');
                    li.className = 'list-group-item d-flex justify-content-between align-items-center';
                    li.innerHTML = `
                        ${patient.username}
                        <span class="online-status ${patient.isOnline ? 'online' : 'offline'}"></span>
                        <button class="btn btn-sm btn-primary" data-patient-id="${patient.id}" data-patient-name="${patient.username}">Chat</button>
                    `;
                    patientList.appendChild(li);
                });

                // Add event listeners to the new "Chat" buttons
                patientList.querySelectorAll('.btn-primary').forEach(button => {
                    button.addEventListener('click', (e) => {
                        const patientId = e.target.getAttribute('data-patient-id');
                        const patientName = e.target.getAttribute('data-patient-name');
                        const doctorId = sessionStorage.getItem('userId');
                        window.location.href = `/message.html?patientId=${patientId}&patientName=${patientName}&doctorId=${doctorId}`;
                    });
                });

            } else {
                patientList.innerHTML = '<li class="list-group-item">No patients have started a conversation yet.</li>';
            }
        } catch (error) {
            console.error('Failed to fetch patients:', error);
        }
    };

    if (doctorId) {
        fetchPatients();
    }

    socket.on('new_patient', (patient) => {
        fetchPatients();
    });

    logoutBtn.addEventListener('click', () => {
        sessionStorage.clear();
        window.location.href = '/';
    });
});