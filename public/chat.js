// This script handles the WebRTC and chat functionality.
const socket = io();

let localStream;
let peerConnection;
let room;

const servers = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }, // Google's public STUN server
    ],
};

// This function is exposed to be called from main.js or other scripts
window.initChatAndVideo = async (doctorId) => {
    room = doctorId; // Use the doctor's ID as the room name
    socket.emit('join', room);

    const localVideo = document.getElementById('local-video');
    const remoteVideo = document.getElementById('remote-video');

    try {
        // Get user media
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = localStream;

        // Create RTCPeerConnection
        peerConnection = new RTCPeerConnection(servers);

        // Add local stream tracks to the connection
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });

        // Listen for remote tracks
        peerConnection.ontrack = (event) => {
            if (remoteVideo.srcObject !== event.streams[0]) {
                remoteVideo.srcObject = event.streams[0];
                console.log('Received remote stream');
            }
        };

        // Listen for ICE candidates
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit('webrtc_ice_candidate', { room, candidate: event.candidate });
            }
        };

        // If the user is a patient, they create the offer
        const userRole = sessionStorage.getItem('userRole');
        if (userRole === 'patients') {
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);
            socket.emit('webrtc_offer', { room, offer });
        }

    } catch (error) {
        console.error('Error initializing chat and video:', error);
        alert("Could not start video. Please ensure you have a camera and have given permission.");
    }
};

// Socket listeners for WebRTC signaling
socket.on('webrtc_offer', async (offer) => {
    if (sessionStorage.getItem('userRole') === 'doctors') {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        socket.emit('webrtc_answer', { room, answer });
        document.getElementById('waiting-for-patient').classList.add('d-none');
        document.getElementById('consultation-room').classList.remove('d-none');
    }
});

socket.on('webrtc_answer', async (answer) => {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
});

socket.on('webrtc_ice_candidate', async (candidate) => {
    try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (e) {
        console.error('Error adding received ice candidate', e);
    }
});

// Chat functionality
document.addEventListener('DOMContentLoaded', () => {
    const chatForm = document.getElementById('chat-form');
    if (chatForm) {
        chatForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const chatInput = document.getElementById('chat-input');
            const message = chatInput.value;
            if (message.trim() && room) {
                // Only emit the message, don't append it here.
                socket.emit('chat_message', { room, message });
                chatInput.value = '';
            }
        });
    }
    // Initialize for doctor if on doctor's page
    if (window.location.pathname.includes('doctor.html')) {
        const doctorId = sessionStorage.getItem('userId');
        if (doctorId) {
            // The doctor just waits, init is triggered by patient's offer
            initChatAndVideo(doctorId); 
            // Announce to the server that a doctor is online
            socket.emit('doctor_joins', { userId: doctorId });
        }
    }
});

// Listen for messages and decide styling based on sender
socket.on('chat_message', (data) => {
    const messageType = data.sender === socket.id ? 'sent' : 'received';
    appendMessage(data.message, messageType);
});

function appendMessage(message, type) {
    const chatBox = document.getElementById('chat-box');
    const messageElement = document.createElement('div');
    messageElement.className = `chat-message ${type}`;
    messageElement.textContent = message;
    chatBox.appendChild(messageElement);
    chatBox.scrollTop = chatBox.scrollHeight;
}
