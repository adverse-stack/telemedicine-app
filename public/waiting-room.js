document.addEventListener('DOMContentLoaded', () => {
    const socket = io();
    const params = new URLSearchParams(window.location.search);
    const doctorId = params.get('doctorId');
    const doctorName = params.get('doctorName');
    const patientId = localStorage.getItem('userId');
    const patientUsername = localStorage.getItem('username');

    if (!doctorId || !patientId) {
        console.error('Missing doctorId or patientId in waiting room.');
        // Optionally redirect to an error page or patient dashboard
        return;
    }

    // Patient joins their own room to receive updates
    socket.emit('patient_joins', { patientId: patientId });

    // Listen for the doctor's acceptance
    socket.on('consultation_accepted', (data) => {
        const { doctorId: acceptedDoctorId, doctorName: acceptedDoctorName } = data;
        // Ensure it's for the current doctor the patient is waiting for
        if (Number(acceptedDoctorId) === Number(doctorId)) {
            console.log(`Doctor ${acceptedDoctorName} accepted consultation. Redirecting to chat.`);
            window.location.href = `/message.html?doctorId=${doctorId}&doctorName=${doctorName}`;
        }
    });

    // Optional: add a timeout or a cancel button
});
