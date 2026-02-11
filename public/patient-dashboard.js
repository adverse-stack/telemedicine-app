document.addEventListener('DOMContentLoaded', async () => {
    // No localStorage checks here. Authentication is handled by HttpOnly cookies and server-side.
    // If API calls fail due to authentication, they will redirect to login.

    const doctorsListDiv = document.getElementById('doctors-list');
    const professionalFilter = document.getElementById('professional-filter');
    const usernameDisplay = document.getElementById('username-display');
    const logoutBtn = document.getElementById('logout-btn');

    // Fetch and display username (example of fetching user-specific data after authentication)
    // In a real app, this might come from a /api/me endpoint or similar
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
        if (usernameDisplay) {
            usernameDisplay.textContent = user.username;
        }
    } catch (error) {
        console.error('Error fetching user details:', error);
        // Fallback or redirect if user details can't be fetched
        window.location.href = 'login.html';
        return;
    }

    const fetchDoctors = async (profession = '') => {
        try {
            const response = await fetch(`/api/doctors?profession=${profession}`);
            if (response.status === 401 || response.status === 403) {
                window.location.href = 'login.html';
                return;
            }
            if (!response.ok) {
                throw new Error('Failed to fetch doctors');
            }
            const doctors = await response.json();
            doctorsListDiv.innerHTML = '';
            if (doctors.length === 0) {
                doctorsListDiv.innerHTML = '<p>No doctors available at the moment.</p>';
                return;
            }
            doctors.forEach(doctor => {
                const doctorCard = document.createElement('div');
                doctorCard.className = 'card doctor-card';
                doctorCard.innerHTML = `
                    <h3>Dr. ${doctor.username}</h3>
                    <p>Specialty: ${doctor.profession}</p>
                    <button class="button-1 consult-btn" data-doctor-id="${doctor.id}" data-doctor-name="Dr. ${doctor.username}">Consult</button>
                `;
                doctorsListDiv.appendChild(doctorCard);
            });

            // Add event listeners for consult buttons
            document.querySelectorAll('.consult-btn').forEach(button => {
                button.addEventListener('click', startConsultation);
            });

        } catch (error) {
            console.error('Error fetching doctors:', error);
            doctorsListDiv.innerHTML = '<p class="error-message">Failed to load doctors.</p>';
        }
    };
    
    // New function to start consultation
    const startConsultation = async (event) => {
        const doctorId = event.target.dataset.doctorId;
        const doctorName = event.target.dataset.doctorName;

        try {
            const response = await fetch('/api/start-conversation', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ doctorId })
            });

            if (response.status === 401 || response.status === 403) {
                window.location.href = 'login.html';
                return;
            }

            const data = await response.json();

            if (data.success) {
                // Redirect to message page with conversation ID
                window.location.href = `message.html?conversationId=${data.conversationId}&doctorId=${doctorId}&doctorName=${doctorName}`;
            } else {
                alert(`Failed to start conversation: ${data.message}`);
            }

        } catch (error) {
            console.error('Error starting conversation:', error);
            alert('An error occurred while starting the conversation.');
        }
    };

    if (professionalFilter) {
        professionalFilter.addEventListener('change', (e) => {
            fetchDoctors(e.target.value);
        });
    }

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

    // Initial fetch of doctors
    fetchDoctors();

    // Socket.IO for real-time presence (patient joins)
    const socket = io();
    socket.emit('patient_joins', { patientId: 'no longer needed, server authenticates socket' }); // Argument not used on server now

});
