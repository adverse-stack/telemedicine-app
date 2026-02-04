document.addEventListener('DOMContentLoaded', () => {
    const socket = io();
    const params = new URLSearchParams(window.location.search);
    const doctorId = params.get('doctorId');
    const doctorName = params.get('doctorName');
    const patientId = localStorage.getItem('userId');
    const patientUsername = localStorage.getItem('username');

    if (!doctorId || !patientId) {
        console.error('Missing doctorId or patientId in waiting room. Redirecting to patient dashboard.');
        window.location.href = '/patient.html'; // Redirect to patient dashboard
        return;
    }

    console.log(`Waiting room loaded for patient ${patientId}, waiting for doctor ${doctorId}.`);
    // Patient joins their own room to receive updates
    console.log(`Emitting 'patient_joins' for patientId: ${patientId}`);
    socket.emit('patient_joins', { patientId: patientId });

    // Listen for the doctor's acceptance
    socket.on('consultation_accepted', (data) => {
        console.log('Received consultation_accepted event:', data);
        const { doctorId: acceptedDoctorId, doctorName: acceptedDoctorName } = data;
        // Ensure it's for the current doctor the patient is waiting for
        if (Number(acceptedDoctorId) === Number(doctorId)) {
            console.log(`Doctor ${acceptedDoctorName} accepted consultation. Redirecting to chat.`);
            window.location.href = `/message.html?doctorId=${doctorId}&doctorName=${doctorName}&patientId=${patientId}&patientName=${patientUsername}`; // Pass patient details for message.js
        }
    });

    // Optional: add a timeout or a cancel button
});
