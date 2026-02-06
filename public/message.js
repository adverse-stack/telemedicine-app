document.addEventListener('DOMContentLoaded', () => {
    const socket = io();

    const chatWithName = document.getElementById('chat-with-name');
    const chatBox = document.getElementById('chat-box');
    const chatForm = document.getElementById('chat-form');
    const chatInput = document.getElementById('chat-input');
    const callBtn = document.getElementById('call-btn');
    const backBtn = document.getElementById('back-btn');

    const params = new URLSearchParams(window.location.search);
    const doctorIdParam = params.get('doctorId');
    const doctorNameParam = params.get('doctorName');
    const patientIdParam = params.get('patientId');
    const patientNameParam = params.get('patientName');
    const conversationId = params.get('conversationId'); // Get conversation ID from URL

    const currentUserId = localStorage.getItem('userId');
    const currentUserRole = localStorage.getItem('userRole');
    const currentUsername = localStorage.getItem('username');

    let room;
    let participantId; // The ID of the person we are chatting with

    // Determine the room based on the conversationId
    if (conversationId) {
        room = conversationId;
        // Set participantId and chatWithName based on role
        if (currentUserRole === 'patient') {
            participantId = doctorIdParam;
            chatWithName.textContent = `Chat with ${doctorNameParam}`;
        } else if (currentUserRole === 'doctor') {
            participantId = patientIdParam;
            chatWithName.textContent = `Chat with ${patientNameParam}`;
        }
    } else {
        // Fallback or error handling if conversationId is missing
        console.error('Conversation ID missing from URL.');
        // Potentially redirect to a dashboard or error page
        if (currentUserRole === 'patient') {
            window.location.href = '/patient-dashboard.html';
        } else if (currentUserRole === 'doctor') {
            window.location.href = '/doctor-dashboard.html';
        }
        return; // Stop further execution
    }
    
    // The patient_joins event is now handled by patient-dashboard.js
    // if (currentUserRole === 'patient') {
    //     socket.emit('patient_joins', { patientId: currentUserId });
    // }

    if (room) {
        socket.emit('join', room);
    }

    // No chat history feature, so fetchChatHistory and its call are removed.

    chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const message = chatInput.value;
        if (message.trim() && conversationId) { // Use conversationId
            socket.emit('chat_message', { room: conversationId, message, senderId: currentUserId });
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
        // Redirect to the dedicated video call page, using conversationId as the room
        const isCaller = currentUserRole === 'patient'; // Patient is always the caller when initiating from message page
        window.location.href = `/video-call.html?room=${conversationId}&caller=${isCaller}`;
    });

    backBtn.addEventListener('click', () => {
        if (currentUserRole === 'patient') {
            window.location.href = '/patient-dashboard.html';
        } else if (currentUserRole === 'doctor') {
            window.location.href = '/doctor-dashboard.html';
        }
    });
});
