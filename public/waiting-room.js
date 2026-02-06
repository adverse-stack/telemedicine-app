document.addEventListener('DOMContentLoaded', () => {
    const socket = io();
    const params = new URLSearchParams(window.location.search);
    const doctorId = params.get('doctorId');
    const doctorName = params.get('doctorName');
    const patientId = localStorage.getItem('userId');
    const patientUsername = localStorage.getItem('username');

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
            window.location.href = `/message.html?doctorId=${doctorId}&doctorName=${doctorName}&patientId=${patientId}&patientName=${patientUsername}&conversationId=${conversationId}`; // Pass patient details for message.js
        }
    });

    // Optional: add a timeout or a cancel button
});
