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
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Missing username or password' });
    }

    try {
        const hash = await bcrypt.hash(password, saltRounds);
        const result = await db.query('INSERT INTO users (username, password, role) VALUES ($1, $2, $3) RETURNING id', [username, hash, 'patient']);
        res.json({ success: true, message: 'Registration successful', userId: result.rows[0].id });
    } catch (err) {
        res.status(400).json({ success: false, message: 'Username already taken' });
    }
});

app.post('/api/login', async (req, res) => {
    const { role, username, password } = req.body;
    
    // Convert plural role from frontend (e.g., "patients") to singular for DB ("patient")
    const singularRole = role.endsWith('s') ? role.slice(0, -1) : role;

    try {
        const { rows } = await db.query('SELECT * FROM users WHERE username = $1 AND role = $2', [username, singularRole]);
        const user = rows[0];

        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        const result = await bcrypt.compare(password, user.password);
        if (result) {
            res.json({ success: true, message: 'Login successful', userId: user.id, role: user.role });
        } else {
            res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.post('/api/admin/doctors', async (req, res) => {
    let { username, password, profession } = req.body;
    if (!username || !password || !profession) {
        return res.status(400).json({ success: false, message: 'Missing required fields.' });
    }
    
    try {
        const hash = await bcrypt.hash(password, saltRounds);
        const result = await db.query('INSERT INTO users (username, password, role, profession) VALUES ($1, $2, $3, $4) RETURNING id, username, profession', [username, hash, 'doctor', profession.trim()]);
        res.json({ success: true, message: 'Doctor created successfully.', doctor: result.rows[0] });
    } catch (err) {
        res.status(400).json({ success: false, message: 'Username already taken' });
    }
});

app.get('/api/admin/doctors', async (req, res) => {
    try {
        const { rows } = await db.query('SELECT id, username, profession FROM users WHERE role = \'doctor\'');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.delete('/api/admin/doctors/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('DELETE FROM users WHERE id = $1 AND role = \'doctor\'', [id]);
        res.json({ success: true, message: 'Doctor deleted successfully.' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
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

app.get('/api/doctor/patients', async (req, res) => {
    const { doctorId } = req.query;
    try {
        const { rows } = await db.query(
            `SELECT u.id, u.username 
             FROM users u
             JOIN conversations c ON u.id = c.patient_id
             WHERE c.doctor_id = $1 AND u.role = 'patient'`,
            [doctorId]
        );
        res.json(rows);
    } catch (err) {
        console.error('Error fetching doctor patients:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.post('/api/start-conversation', async (req, res) => {
    const { patientId, doctorId } = req.body;
    try {
        // Check if conversation already exists
        const { rows } = await db.query(
            'SELECT id FROM conversations WHERE patient_id = $1 AND doctor_id = $2',
            [patientId, doctorId]
        );

        if (rows.length === 0) {
            // Create new conversation
            await db.query(
                'INSERT INTO conversations (patient_id, doctor_id) VALUES ($1, $2)',
                [patientId, doctorId]
            );
        }
        
        // Notify doctor of new patient
        const doctorSocketId = onlineDoctors[doctorId]?.socketId;
        if (doctorSocketId) {
            const { rows: patientRows } = await db.query('SELECT id, username FROM users WHERE id = $1', [patientId]);
            if (patientRows.length > 0) {
                io.to(doctorSocketId).emit('new_patient', patientRows[0]);
            }
        }
        
        res.json({ success: true, message: 'Conversation started.' });
    } catch (err) {
        console.error('Error starting conversation:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.get('/api/chat/history', async (req, res) => {
    const { conversationId } = req.query;
    try {
        const { rows } = await db.query(
            'SELECT * FROM messages WHERE conversation_id = $1 ORDER BY timestamp ASC',
            [conversationId]
        );
        res.json(rows);
    } catch (err) {
        console.error('Error fetching chat history:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.get('/api/conversation', async (req, res) => {
    const { patientId, doctorId } = req.query;
    try {
        const { rows } = await db.query(
            'SELECT id FROM conversations WHERE patient_id = $1 AND doctor_id = $2',
            [patientId, doctorId]
        );
        if (rows.length > 0) {
            res.json({ conversationId: rows[0].id });
        } else {
            res.json({ conversationId: null });
        }
    } catch (err) {
        console.error('Error fetching conversation:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});


// Socket.IO Connection Handling
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('doctor_joins', async (data) => {
        const { userId } = data;
        try {
            // Fetch doctor details from DB
            const { rows } = await db.query('SELECT id, username, profession FROM users WHERE id = $1 AND role = \'doctor\'', [userId]);
            const doctor = rows[0];
            if (doctor) {
                console.log(`Doctor ${doctor.username} is online.`);
                onlineDoctors[doctor.id] = { ...doctor, socketId: socket.id };
            }
        } catch (err) {
            console.error('Error fetching doctor details:', err);
        }
    });

    socket.on('join', (room) => {
        console.log(`Socket ${socket.id} joining room ${room}`);
        socket.join(room);
    });

    socket.on('chat_message', async (data) => {
        const { room: doctorId, message, senderId } = data;
        const patientId = senderId;

        try {
            // Get conversation ID
            const { rows } = await db.query(
                'SELECT id FROM conversations WHERE patient_id = $1 AND doctor_id = $2',
                [patientId, doctorId]
            );
            
            if (rows.length > 0) {
                const conversationId = rows[0].id;
                // Save message
                await db.query(
                    'INSERT INTO messages (conversation_id, sender_id, message) VALUES ($1, $2, $3)',
                    [conversationId, senderId, message]
                );

                // Broadcast the message to the room (which is the doctorId)
                io.to(doctorId).emit('chat_message', { senderId, message });
            }
        } catch (err) {
            console.error('Error saving or broadcasting chat message:', err);
        }
    });
    
    // WebRTC Signaling
    socket.on('webrtc_offer', (data) => {
        const { room } = data;
        socket.to(room).emit('webrtc_offer', data);
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

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
});
