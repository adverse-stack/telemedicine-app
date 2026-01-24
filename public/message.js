document.addEventListener('DOMContentLoaded', () => {
    const socket = io();

    const chatWithName = document.getElementById('chat-with-name');
    const chatBox = document.getElementById('chat-box');
    const chatForm = document.getElementById('chat-form');
    const chatInput = document.getElementById('chat-input');
    const callBtn = document.getElementById('call-btn');
    const backBtn = document.getElementById('back-btn');

    const params = new URLSearchParams(window.location.search);
    const doctorId = params.get('doctorId');
    const doctorName = params.get('doctorName');
    const patientId = sessionStorage.getItem('userId');
    const patientName = sessionStorage.getItem('username');
    const userRole = sessionStorage.getItem('userRole');

    let room;

    if (userRole === 'patients') {
                room = doctorId; // Use doctorId as room name for patients
                chatWithName.textContent = `Chat with ${doctorName}`;
                socket.emit('patient_joins', { patientId });
            } else if (userRole === 'doctors') {        const pId = params.get('patientId');
        const pName = params.get('patientName');
        room = doctorId; // Doctor also joins room based on their own ID
        chatWithName.textContent = `Chat with ${pName}`;
    }

    if (room) {
        socket.emit('join', room);
    }

    // Fetch chat history
    const fetchChatHistory = async () => {
        let pId, dId;
        if (userRole === 'patients') {
            pId = patientId;
            dId = doctorId;
        } else if (userRole === 'doctors') {
            pId = params.get('patientId');
            dId = sessionStorage.getItem('userId');
        }

        if (pId && dId) {
            try {
                const convResponse = await fetch(`/api/conversation?patientId=${pId}&doctorId=${dId}`);
                const { conversationId } = await convResponse.json();

                if (conversationId) {
                    const historyResponse = await fetch(`/api/chat/history?conversationId=${conversationId}`);
                    const history = await historyResponse.json();
                    history.forEach(msg => {
                        const messageType = msg.sender_id == patientId ? 'sent' : 'received';
                        appendMessage(msg.message, messageType);
                    });
                }
            } catch (error) {
                console.error('Failed to fetch chat history:', error);
            }
        }
    };

    fetchChatHistory();

    chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const message = chatInput.value;
        if (message.trim() && room) {
            socket.emit('chat_message', { room, message, senderId: patientId });
            chatInput.value = '';
        }
    });

    socket.on('chat_message', (data) => {
        const currentUserId = sessionStorage.getItem('userId');
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
        // Redirect to video call page, indicating this user is the caller
        const url = userRole === 'patients' ? 
            `/patient.html?video=true&room=${doctorId}&caller=true` : 
            `/doctor.html?video=true&room=${sessionStorage.getItem('userId')}&caller=true&patientId=${params.get('patientId')}`;
        window.location.href = url;
    });

    backBtn.addEventListener('click', () => {
        if (userRole === 'patients') {
            window.location.href = '/patient.html';
        } else if (userRole === 'doctors') {
            window.location.href = '/doctor-dashboard.html'; // This page needs to be created
        }
    });
});
