document.addEventListener('DOMContentLoaded', () => {
    const socket = io();

    const chatWithName = document.getElementById('chat-with-name');
    const chatBox = document.getElementById('chat-box');
    const chatForm = document.getElementById('chat-form');
    const chatInput = document.getElementById('chat-input');
    const callBtn = document.getElementById('call-btn');
    const backBtn = document.getElementById('back-btn');

    const params = new URLSearchParams(window.location.search);
    const doctorIdParam = params.get('doctorId'); // Doctor ID from URL (for patient)
    const doctorNameParam = params.get('doctorName'); // Doctor Name from URL (for patient)
    const patientIdParam = params.get('patientId'); // Patient ID from URL (for doctor)
    const patientNameParam = params.get('patientName'); // Patient Name from URL (for doctor)

    const currentUserId = localStorage.getItem('userId');
    const currentUserRole = localStorage.getItem('userRole');
    const currentUsername = localStorage.getItem('username');

    let room;
    let participantId; // The ID of the person we are chatting with

    if (currentUserRole === 'patient') {
        room = doctorIdParam; // Patient uses doctor's ID as room
        participantId = doctorIdParam;
        chatWithName.textContent = `Chat with ${doctorNameParam}`;
        socket.emit('patient_joins', { patientId: currentUserId });
    } else if (currentUserRole === 'doctor') {
        room = patientIdParam; // Doctor uses patient's ID as room
        participantId = patientIdParam;
        chatWithName.textContent = `Chat with ${patientNameParam}`;
    }

    if (room) {
        socket.emit('join', room);
    }

    // No chat history feature, so fetchChatHistory and its call are removed.

    chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const message = chatInput.value;
        if (message.trim() && room) {
            // For chat, doctorId is the room, patientId is the sender for patients.
            // For doctors, the room should be the patientId, and senderId is doctorId.
            let chatRoomId = doctorIdParam; // For patient sending, room is the doctor's ID
            let chatSenderId = currentUserId;

            if (currentUserRole === 'doctor') {
                chatRoomId = patientIdParam; // For doctor sending, room is the patient's ID
                chatSenderId = currentUserId;
            } else if (currentUserRole === 'patient') {
                chatRoomId = doctorIdParam;
                chatSenderId = currentUserId;
            }

            socket.emit('chat_message', { room: chatRoomId, message, senderId: chatSenderId });
            chatInput.value = '';
        }
    });

    socket.on('chat_message', (data) => {
        const messageType = data.senderId == currentUserId ? 'sent' : 'received';
        appendMessage(data.message, messageType);
    });

    function appendMessage(message, type) {
        const messageElement = document.createElement('div');
        messageElement.className = `chat-message ${type}`;
        messageElement.textContent = message;
        chatBox.appendChild(messageElement);
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    callBtn.addEventListener('click', () => {
        let videoRoomId;
        let isCaller;

        if (currentUserRole === 'patient') {
            videoRoomId = doctorIdParam;
            isCaller = true;
            localStorage.setItem('selectedDoctorId', doctorIdParam); // Keep this for patient context
        } else if (currentUserRole === 'doctor') {
            videoRoomId = patientIdParam; // Doctor calls patient
            isCaller = true; // Doctor is the caller in this case
        }
        
        // Redirect to the dedicated video call page
        window.location.href = `/video-call.html?room=${videoRoomId}&caller=${isCaller}`;
    });

    backBtn.addEventListener('click', () => {
        if (currentUserRole === 'patient') {
            window.location.href = '/index.html';
        } else if (currentUserRole === 'doctor') {
            window.location.href = '/doctor-dashboard.html';
        }
    });
});
