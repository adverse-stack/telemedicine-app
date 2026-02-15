document.addEventListener('DOMContentLoaded', async () => {
    // No localStorage checks here. Authentication is handled by HttpOnly cookies and server-side.
    // If API calls fail due to authentication, they will redirect to login.

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

    let currentUserId;
    let currentUserRole;
    let currentUsername;
    let participantLabel = 'Participant';

    // Fetch authenticated user details
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
        currentUserId = user.userId;
        currentUserRole = user.role;
        currentUsername = user.username;
    } catch (error) {
        console.error('Error fetching user details:', error);
        window.location.href = 'login.html';
        return;
    }

    console.log('Message.js URL Params:', {
        doctorIdParam,
        doctorNameParam,
        patientIdParam,
        patientNameParam,
        conversationId
    });
    
    let room;
    // participantId is the ID of the person we are chatting with
    let participantId; 

    // Determine the room based on the conversationId
    if (conversationId) {
        room = conversationId;
        // Set participantId and chatWithName based on role
        if (currentUserRole === 'patient') {
            participantId = doctorIdParam;
            participantLabel = doctorNameParam || 'Doctor';
            chatWithName.textContent = `Chat with ${participantLabel}`;
        } else if (currentUserRole === 'doctor') {
            participantId = patientIdParam;
            participantLabel = patientNameParam || `Patient ${patientIdParam || ''}`.trim();
            chatWithName.textContent = `Chat with ${participantLabel}`;
        }
    } else {
        // Fallback or error handling if conversationId is missing
        console.error('Conversation ID missing from URL. Redirecting to dashboard.');
        if (currentUserRole === 'patient') {
            window.location.href = '/patient-dashboard.html';
        } else if (currentUserRole === 'doctor') {
            window.location.href = '/doctor-dashboard.html';
        }
        return; // Stop further execution
    }
    
    if (room) {
        socket.emit('join', room);
        if (currentUserRole === 'patient') {
            socket.emit('patient_joins');
        } else if (currentUserRole === 'doctor') {
            socket.emit('doctor_joins');
        }
    }

    chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const message = chatInput.value.trim();
        if (message.trim() && conversationId) {
            // senderId is included for clarity, but server will use authenticated socket.userId
            socket.emit('chat_message', { room: conversationId, message, senderId: currentUserId }); 
            chatInput.value = '';
        }
    });

    socket.on('chat_message', (data) => {
        const messageType = Number(data.senderId) === Number(currentUserId) ? 'sent' : 'received';
        const senderLabel = messageType === 'sent' ? 'You' : participantLabel;
        appendMessage(data.message, messageType, senderLabel);
    });

    function appendMessage(message, type, senderLabel) {
        const messageElement = document.createElement('div');
        messageElement.className = `chat-message ${type}`;
        messageElement.innerHTML = `
            <div class="chat-message-meta">${senderLabel}</div>
            <div class="chat-message-text">${message}</div>
        `;
        chatBox.appendChild(messageElement);
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    callBtn.addEventListener('click', () => {
        // Redirect to the dedicated video call page, using conversationId as the room
        const isCaller = currentUserRole === 'patient'; // Patient is always the caller when initiating from message page
        window.location.href = `/video-call.html?room=${conversationId}&caller=${isCaller}`;
    });

    backBtn.addEventListener('click', () => {
        // Primary source is authenticated role. Fallback uses URL shape for robustness.
        if (currentUserRole === 'doctor' || (patientIdParam && patientNameParam)) {
            window.location.href = '/doctor-dashboard.html';
        } else {
            window.location.href = '/patient-dashboard.html';
        }
    });
});
