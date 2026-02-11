document.addEventListener('DOMContentLoaded', async () => {
    // No localStorage checks here. Authentication is handled by HttpOnly cookies and server-side.
    // If API calls fail due to authentication, they will redirect to login.

    const patientList = document.getElementById('patient-list');
    const logoutBtn = document.getElementById('logout-btn');

    let currentDoctorId;
    let currentDoctorUsername;
    let currentDoctorRole; // Not strictly needed here, but good to have consistency

    // Fetch and display doctor details (example of fetching user-specific data after authentication)
    try {
        const response = await fetch('/api/user/details'); // New endpoint to get authenticated user details
        if (response.status === 401 || response.status === 403) {
            window.location.href = 'login.html';
            return;
        }
        if (!response.ok) {
            throw new Error('Failed to fetch user details');
        }
        const user = await response.json();
        currentDoctorId = user.userId;
        currentDoctorUsername = user.username;
        currentDoctorRole = user.role;

        // Ensure the authenticated user is a doctor
        if (currentDoctorRole !== 'doctor') {
            console.warn('Authenticated user is not a doctor. Redirecting.');
            window.location.href = 'login.html';
            return;
        }

    } catch (error) {
        console.error('Error fetching user details:', error);
        window.location.href = 'login.html';
        return;
    }

    const socket = io();
    
    if (currentDoctorId) {
        socket.emit('doctor_joins'); // userId is now from authenticated socket
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
            // Doctor ID and Name are now obtained from authenticated details, not localStorage
            const doctorId = currentDoctorId;
            const doctorName = currentDoctorUsername;

            socket.emit('doctor_accepts_consultation', { patientId: Number(patientId), doctorId: Number(doctorId), doctorName: doctorName, conversationId: Number(conversationId) });

            window.location.href = `/message.html?patientId=${patientId}&patientName=${patientName}&doctorId=${doctorId}&doctorName=${doctorName}&conversationId=${conversationId}`;
        });
    };

    // Fetch patients who have conversations with the doctor
    const fetchPatients = async () => {
        try {
            const response = await fetch(`/api/doctor/patients?doctorId=${currentDoctorId}`); // Use authenticated doctor ID
            if (response.status === 401 || response.status === 403) {
                window.location.href = 'login.html';
                return;
            }
            if (!response.ok) {
                throw new Error('Failed to fetch patients');
            }
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

    if (currentDoctorId) {
        fetchPatients();
    }

    socket.on('new_patient_request', (patient) => {
        // Patient data now includes conversationId from server, needs id/username for addPatientToList
        addPatientToList({ id: patient.patientId, username: patient.patientName, conversationId: patient.conversationId, isOnline: true });
    });

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                const response = await fetch('/api/logout', { method: 'POST' });
                if (response.ok) {
                    window.location.href = 'login.html';
                } else {
                    alert('Logout failed. Please try again.');
                }
            } catch (error) {
                console.error('Error during logout:', error);
                alert('An error occurred during logout.');
            }
        });
    }
});