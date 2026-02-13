document.addEventListener('DOMContentLoaded', async () => {
    // No localStorage checks here. Authentication is handled by HttpOnly cookies and server-side.
    // If API calls fail due to authentication, they will redirect to login.

    const doctorsList = document.getElementById('doctor-list');
    const professionFilter = document.getElementById('profession');
    const findDoctorsBtn = document.getElementById('find-doctors-btn');
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
        if (!doctorsList) return;
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
            doctorsList.innerHTML = '';
            if (doctors.length === 0) {
                doctorsList.innerHTML = '<li class="custom-list-item placeholder">No doctors available at the moment.</li>';
                return;
            }
            doctors.forEach(doctor => {
                const item = document.createElement('li');
                item.className = 'custom-list-item';
                item.innerHTML = `
                    <span>Dr. ${doctor.username} (${doctor.profession})</span>
                    <button class="button-1 consult-btn" data-doctor-id="${doctor.id}" data-doctor-name="Dr. ${doctor.username}">Consult</button>
                `;
                doctorsList.appendChild(item);
            });

            // Add event listeners for consult buttons
            document.querySelectorAll('.consult-btn').forEach(button => {
                button.addEventListener('click', startConsultation);
            });

        } catch (error) {
            console.error('Error fetching doctors:', error);
            doctorsList.innerHTML = '<li class="custom-list-item error-message">Failed to load doctors.</li>';
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

    if (findDoctorsBtn && professionFilter) {
        findDoctorsBtn.addEventListener('click', () => {
            fetchDoctors(professionFilter.value);
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
    if (professionFilter) {
        fetchDoctors(professionFilter.value);
    }

    // Socket.IO for real-time presence (patient joins)
    const socket = io();
    socket.emit('patient_joins', { patientId: 'no longer needed, server authenticates socket' }); // Argument not used on server now

});
