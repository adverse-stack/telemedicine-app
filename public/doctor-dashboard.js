document.addEventListener('DOMContentLoaded', () => {
    const userId = localStorage.getItem('userId');
    const username = localStorage.getItem('username');
    const userRole = localStorage.getItem('userRole');

    console.log('[doctor-dashboard.js] localStorage on load - userId:', userId, 'username:', username, 'userRole:', userRole);

    if (!userId || !username || userRole !== 'doctor') {
        console.warn('Doctor session data missing or user role mismatch. Redirecting to login.');
        localStorage.clear();
        window.location.href = 'login.html';
        return; // Stop execution if not authenticated
    }

    const socket = io();
    const patientList = document.getElementById('patient-list');
    const logoutBtn = document.getElementById('logout-btn');

    const doctorId = userId; // Use the verified userId

    if (doctorId) {
        socket.emit('doctor_joins', { userId: doctorId });
    }

    // Helper function to add/update a patient in the list
    const addPatientToList = (user) => {
        const id = user.id || user.patientId; // Handle both structures (id from fetch, patientId from socket event)
        const username = user.username || user.patientName; // Handle both structures

        let patientItem = document.getElementById(`patient-${id}`);
        if (!patientItem) {
            patientItem = document.createElement('li');
            patientItem.className = 'custom-list-item';
            patientItem.id = `patient-${id}`;
            patientList.appendChild(patientItem);
        }
        
        // conversationId will be present for new requests and in the redirect URL after doctor accepts
        const conversationId = user.conversationId || ''; 

        patientItem.innerHTML = `
            <span>${username}
            <span class="online-status ${user.isOnline ? 'online' : 'offline'}"></span></span>
            <button class="button-1" data-patient-id="${id}" data-patient-name="${username}" data-conversation-id="${conversationId}">Chat</button>
        `;

        patientItem.querySelector('.button-1').addEventListener('click', (e) => {
            const patientId = e.target.getAttribute('data-patient-id');
            const patientName = e.target.getAttribute('data-patient-name');
            const conversationId = e.target.getAttribute('data-conversation-id');
            const doctorId = localStorage.getItem('userId');
            const doctorName = localStorage.getItem('username'); // Get doctor's username for emit

            socket.emit('doctor_accepts_consultation', { patientId: Number(patientId), doctorId: Number(doctorId), doctorName: username, conversationId: Number(conversationId) });

            window.location.href = `/message.html?patientId=${patientId}&patientName=${patientName}&doctorId=${doctorId}&doctorName=${username}&conversationId=${conversationId}`;
        });
    };

    // Fetch patients who have conversations with the doctor
    const fetchPatients = async () => {
        try {
            const response = await fetch(`/api/doctor/patients?doctorId=${doctorId}`);
            const patients = await response.json();

            patientList.innerHTML = ''; // Clear previous list
            if (patients.length > 0) {
                patients.forEach(patient => addPatientToList(patient)); // Pass patient directly, it has id, username, isOnline
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
        // Patient data now includes conversationId from server, needs id/username for addPatientToList
        addPatientToList({ id: patient.patientId, username: patient.patientName, conversationId: patient.conversationId, isOnline: true });
    });

    logoutBtn.addEventListener('click', () => {
        localStorage.clear();
        window.location.href = 'login.html';
    });
});