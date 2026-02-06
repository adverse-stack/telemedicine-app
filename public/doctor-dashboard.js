document.addEventListener('DOMContentLoaded', () => {
    const socket = io();
    const patientList = document.getElementById('patient-list');
    const logoutBtn = document.getElementById('logout-btn');

    const doctorId = localStorage.getItem('userId');

    if (doctorId) {
        socket.emit('doctor_joins', { userId: doctorId });
    }

    // Helper function to add/update a patient in the list
    const addPatientToList = (patient) => {
        let patientItem = document.getElementById(`patient-${patient.id}`);
        if (!patientItem) {
            patientItem = document.createElement('li');
            patientItem.className = 'custom-list-item';
            patientItem.id = `patient-${patient.id}`;
            patientList.appendChild(patientItem);
        }
        
        // Ensure patient.conversationId is available if adding from new_patient_request
        const conversationId = patient.conversationId || '';

        patientItem.innerHTML = `
            <span>${patient.username}
            <span class="online-status ${patient.isOnline ? 'online' : 'offline'}"></span></span>
            <button class="button-1" data-patient-id="${patient.id}" data-patient-name="${patient.username}" data-conversation-id="${conversationId}">Chat</button>
        `;

        patientItem.querySelector('.button-1').addEventListener('click', (e) => {
            const patientId = e.target.getAttribute('data-patient-id');
            const patientName = e.target.getAttribute('data-patient-name');
            const conversationId = e.target.getAttribute('data-conversation-id');
            const doctorId = localStorage.getItem('userId');
            
            socket.emit('doctor_accepts_consultation', { patientId: Number(patientId), doctorId: Number(doctorId), doctorName: localStorage.getItem('username'), conversationId: Number(conversationId) });

            window.location.href = `/message.html?patientId=${patientId}&patientName=${patientName}&doctorId=${doctorId}&conversationId=${conversationId}`;
        });
    };

    // Fetch patients who have conversations with the doctor
    const fetchPatients = async () => {
        try {
            const response = await fetch(`/api/doctor/patients?doctorId=${doctorId}`);
            const patients = await response.json();

            patientList.innerHTML = ''; // Clear previous list
            if (patients.length > 0) {
                patients.forEach(patient => addPatientToList(patient));
            } else {
                patientList.innerHTML = '<li class="custom-list-item placeholder">No patients have started a conversation yet.</li>';
            }
        } catch (error) {
            console.error('Failed to fetch patients:', error);
            patientList.innerHTML = '<li class="custom-list-item error-message">Failed to load patients.</li>';
        }
    };

    if (doctorId) {
        fetchPatients();
    }

    socket.on('new_patient_request', (patient) => {
        // Patient data now includes conversationId from server
        addPatientToList({ ...patient, isOnline: true }); // Explicitly set isOnline for new requests
    });

    logoutBtn.addEventListener('click', () => {
        localStorage.clear();
        window.location.href = 'login.html';
    });
});