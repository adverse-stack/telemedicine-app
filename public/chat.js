// This script handles the WebRTC functionality.
const socket = io();

let localStream;
let peerConnection;
let iceCandidateBuffer = []; // Buffer for ICE candidates

const servers = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }, // Google's public STUN server
    ],
};

const initVideo = async (room) => {
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
        console.error('Error initializing video:', error);
        alert("Could not start video. Please ensure you have a camera and have given permission.");
    }
};

// Function to process buffered ICE candidates
const processIceCandidateBuffer = async () => {
    while (iceCandidateBuffer.length > 0) {
        const candidate = iceCandidateBuffer.shift();
        try {
            await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
            console.error('Error adding buffered ice candidate', e);
        }
    }
};

// Socket listeners for WebRTC signaling
socket.on('webrtc_offer', async ({ room, offer }) => {
    const userRole = sessionStorage.getItem('userRole');
    if (userRole === 'doctors') {
        if (!peerConnection) await initVideo(room);
        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        socket.emit('webrtc_answer', { room, answer });

        // Process any candidates that arrived early
        await processIceCandidateBuffer();

        document.getElementById('waiting-for-patient').classList.add('d-none');
        document.getElementById('consultation-room').classList.remove('d-none');
    }
});

socket.on('webrtc_answer', async (answer) => {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    // Process any candidates that arrived early
    await processIceCandidateBuffer();
});

socket.on('webrtc_ice_candidate', async (candidate) => {
    // If the peer connection isn't ready or doesn't have a remote description, buffer the candidate
    if (!peerConnection || !peerConnection.remoteDescription) {
        iceCandidateBuffer.push(candidate);
        return;
    }
    // Otherwise, add the ICE candidate immediately
    try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (e) {
        console.error('Error adding received ice candidate', e);
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const video = params.get('video');
    const room = params.get('room');

    if (video && room) {
        const consultationRoom = document.getElementById('consultation-room');
        if(consultationRoom) {
            consultationRoom.classList.remove('d-none');
        }
        
        const professionSelection = document.getElementById('profession-selection');
        if(professionSelection) {
            professionSelection.classList.add('d-none');
        }

        const doctorListContainer = document.getElementById('doctor-list-container');
        if(doctorListContainer) {
            doctorListContainer.classList.add('d-none');
        }
        
        initVideo(room);
    }
});