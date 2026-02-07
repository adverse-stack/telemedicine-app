document.addEventListener('DOMContentLoaded', () => {
    const userId = localStorage.getItem('userId');
    const username = localStorage.getItem('username');
    const userRole = localStorage.getItem('userRole');

    if (!userId || !username || !userRole) {
        console.warn('Session data missing or invalid for message page. Redirecting to login.');
        localStorage.clear();
        window.location.href = 'login.html';
        return; // Stop execution if not authenticated
    }

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

    console.log('Message.js URL Params:', {
        doctorIdParam,
        doctorNameParam,
        patientIdParam,
        patientNameParam,
        conversationId
    });

    const currentUserId = userId; // Use verified userId
    const currentUserRole = userRole; // Use verified userRole
    const currentUsername = username; // Use verified username

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
        fetchChatHistory(conversationId); // Fetch history when joining the room
    }

    async function fetchChatHistory(convId) {
        try {
            const response = await fetch(`/api/chat/history/${convId}`);
            if (response.ok) {
                const messages = await response.json();
                messages.forEach(msg => {
                    const messageType = msg.sender_id == currentUserId ? 'sent' : 'received';
                    appendMessage(msg.message_content, messageType, msg.timestamp);
                });
            } else {
                console.error('Failed to fetch chat history:', response.statusText);
            }
        } catch (error) {
            console.error('Error fetching chat history:', error);
        }
    }

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
        appendMessage(data.message, messageType, data.timestamp);
    });

    function appendMessage(message, type, timestamp = new Date()) {
        const messageElement = document.createElement('div');
        messageElement.className = `chat-message ${type}`;
        
        const timestampOptions = { hour: '2-digit', minute: '2-digit', second: '2-digit' };
        const formattedTime = new Date(timestamp).toLocaleTimeString([], timestampOptions);

        messageElement.innerHTML = `
            <span class="message-content">${message}</span>
            <span class="timestamp">${formattedTime}</span>
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
        if (currentUserRole === 'patient') {
            window.location.href = '/patient-dashboard.html';
        } else if (currentUserRole === 'doctor') {
            window.location.href = '/doctor-dashboard.html';
        }
    });
});
