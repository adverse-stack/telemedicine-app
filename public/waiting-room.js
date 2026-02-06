document.addEventListener('DOMContentLoaded', () => {
    const userId = localStorage.getItem('userId');
    const username = localStorage.getItem('username');
    const userRole = localStorage.getItem('userRole');

    if (!userId || !username || userRole !== 'patient') {
        console.warn('Patient session data missing or invalid for waiting room. Redirecting to login.');
        localStorage.clear();
        window.location.href = 'login.html';
        return; // Stop execution if not authenticated
    }

    const socket = io();
    const params = new URLSearchParams(window.location.search);
    const doctorId = params.get('doctorId');
    const doctorName = params.get('doctorName');
    const patientId = userId; // Use verified userId
    const patientUsername = username; // Use verified username

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
