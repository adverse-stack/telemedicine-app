document.addEventListener('DOMContentLoaded', async () => {
    const socket = io();
    const params = new URLSearchParams(window.location.search);
    const doctorId = params.get('doctorId');
    const doctorName = params.get('doctorName');
    let patientId;
    let patientUsername;

    try {
        const response = await fetch('/api/user/details');
        if (response.status === 401 || response.status === 403) {
            window.location.href = 'login.html';
            return;
        }
        if (!response.ok) {
            throw new Error('Failed to fetch user details');
        }
        const user = await response.json();
        if (user.role !== 'patient') {
            window.location.href = 'login.html';
            return;
        }
        patientId = user.userId;
        patientUsername = user.username;
    } catch (error) {
        console.error('Failed to load user details for waiting room:', error);
        window.location.href = 'login.html';
        return;
    }

    if (!doctorId || !patientId) {
        console.error('Missing doctorId or patientId in waiting room. Redirecting to patient dashboard.');
        window.location.href = '/patient-dashboard.html'; // Redirect to patient dashboard
        return;
    }

    // Patient joins their own room to receive updates
    socket.emit('patient_joins', { patientId: patientId });

    // Listen for the doctor's acceptance
    socket.on('consultation_accepted', (data) => {
        const { doctorId: acceptedDoctorId, doctorName: acceptedDoctorName, conversationId } = data;
        // Ensure it's for the current doctor the patient is waiting for
        if (Number(acceptedDoctorId) === Number(doctorId)) {
            console.log('Redirecting patient to message.html with params:', {
                doctorId: doctorId,
                doctorName: doctorName,
                patientId: patientId,
                patientName: patientUsername,
                conversationId: conversationId
            });
            window.location.href = `/message.html?doctorId=${doctorId}&doctorName=${doctorName}&patientId=${patientId}&patientName=${patientUsername}&conversationId=${conversationId}`; // Pass patient details for message.js
        }
    });

    // Optional: add a timeout or a cancel button
});
