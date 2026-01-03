const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const bcrypt = require('bcrypt');
const db = require('./database.js');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;
const saltRounds = 10;
const onlineDoctors = {}; // In-memory store for online doctors

// Middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});
app.use(express.static('public'));
app.use(express.json());

// Prevent caching for API routes
app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
});

// API Routes
app.post('/api/register', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Missing username or password' });
    }

    bcrypt.hash(password, saltRounds, (err, hash) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Error hashing password' });
        }
        db.run('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', [username, hash, 'patient'], function(err) {
            if (err) {
                return res.status(400).json({ success: false, message: 'Username already taken' });
            }
            res.json({ success: true, message: 'Registration successful', userId: this.lastID });
        });
    });
});

app.post('/api/login', (req, res) => {
    const { role, username, password } = req.body;
    
    // Convert plural role from frontend (e.g., "patients") to singular for DB ("patient")
    const singularRole = role.endsWith('s') ? role.slice(0, -1) : role;

    db.get('SELECT * FROM users WHERE username = ? AND role = ?', [username, singularRole], (err, user) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Server error' });
        }
        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        bcrypt.compare(password, user.password, (err, result) => {
            if (result) {
                res.json({ success: true, message: 'Login successful', userId: user.id, role: user.role });
            } else {
                res.status(401).json({ success: false, message: 'Invalid credentials' });
            }
        });
    });
});

app.post('/api/admin/doctors', (req, res) => {
    let { username, password, profession } = req.body;
    if (!username || !password || !profession) {
        return res.status(400).json({ success: false, message: 'Missing required fields.' });
    }
    
    bcrypt.hash(password, saltRounds, (err, hash) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Error hashing password' });
        }
        db.run('INSERT INTO users (username, password, role, profession) VALUES (?, ?, ?, ?)', [username, hash, 'doctor', profession.trim()], function(err) {
            if (err) {
                return res.status(400).json({ success: false, message: 'Username already taken' });
            }
            res.json({ success: true, message: 'Doctor created successfully.', doctor: { id: this.lastID, username, profession: profession.trim() } });
        });
    });
});

app.get('/api/doctors', (req, res) => {
    const { profession } = req.query;
    let availableDoctors = Object.values(onlineDoctors);

    if (profession) {
        // Case-insensitive filtering
        availableDoctors = availableDoctors.filter(doc => doc.profession.toLowerCase() === profession.toLowerCase());
    }
    
    res.json(availableDoctors);
});

// Socket.IO Connection Handling
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('doctor_joins', (data) => {
        const { userId } = data;
        // Fetch doctor details from DB
        db.get('SELECT id, username, profession FROM users WHERE id = ? AND role = ?', [userId, 'doctor'], (err, doctor) => {
            if (doctor) {
                console.log(`Doctor ${doctor.username} is online.`);
                onlineDoctors[doctor.id] = { ...doctor, socketId: socket.id };
            }
        });
    });

    socket.on('join', (room) => {
        console.log(`Socket ${socket.id} joining room ${room}`);
        socket.join(room);
    });

    socket.on('chat_message', (data) => {
        const { room, message } = data;
        // Broadcast the message to the room
        io.to(room).emit('chat_message', { sender: socket.id, message });
    });
    
    // WebRTC Signaling
    socket.on('webrtc_offer', (data) => {
        const { room, offer } = data;
        socket.to(room).emit('webrtc_offer', offer);
    });

    socket.on('webrtc_answer', (data) => {
        const { room, answer } = data;
        socket.to(room).emit('webrtc_answer', answer);
    });

    socket.on('webrtc_ice_candidate', (data) => {
        const { room, candidate } = data;
        socket.to(room).emit('webrtc_ice_candidate', candidate);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        // Find and remove the doctor from onlineDoctors if they disconnect
        const disconnectedDoctorId = Object.keys(onlineDoctors).find(
            id => onlineDoctors[id].socketId === socket.id
        );
        if (disconnectedDoctorId) {
            console.log(`Doctor ${onlineDoctors[disconnectedDoctorId].username} went offline.`);
            delete onlineDoctors[disconnectedDoctorId];
        }
    });
});

server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
