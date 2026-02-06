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
const onlinePatients = {}; // In-memory store for online patients

// Middleware
app.use((req, res, next) => {
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
        // Filter to include only online patients
        const onlineFilteredPatients = rows.filter(patient => onlinePatients.hasOwnProperty(patient.id));

        const patientsWithOnlineStatus = onlineFilteredPatients.map(patient => ({
            ...patient,
            isOnline: true // Since we filtered, they are all online
        }));
        res.json(patientsWithOnlineStatus);
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
        const doctorSocketId = onlineDoctors[Number(doctorId)]?.socketId; // Ensure doctorId is number
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


// Socket.IO Connection Handling
io.on('connection', (socket) => {
    socket.on('doctor_joins', async (data) => {
        const { userId } = data;
        const doctorNumId = Number(userId); // Convert to number
        try {
            // Fetch doctor details from DB
            const { rows } = await db.query('SELECT id, username, profession FROM users WHERE id = $1 AND role = \'doctor\'', [doctorNumId]);
            const doctor = rows[0];
            if (doctor) {
                onlineDoctors[doctor.id] = { ...doctor, socketId: socket.id };
            }
        } catch (err) {
            console.error('Error fetching doctor details:', err);
        }
    });

    socket.on('patient_joins', (data) => {
        const { patientId } = data;
        onlinePatients[Number(patientId)] = socket.id; // Convert patientId to number
    });

    socket.on('join', (room) => {
        socket.join(room);
    });

    socket.on('chat_message', async (data) => {
        const { room, message, senderId } = data; // Use 'room' directly
        const numericRoom = Number(room); // Ensure room is a number
        const numericSenderId = Number(senderId); // Ensure senderId is a number

        try {
            io.to(numericRoom).emit('chat_message', { senderId: numericSenderId, message });
        } catch (err) {
            console.error('Error broadcasting chat message:', err);
        }
    });
    
    // WebRTC Signaling
    socket.on('webrtc_offer', (data) => {
        const { room } = data;
        io.to(Number(room)).emit('webrtc_offer', data); // Ensure room is a number for Socket.IO room
    });

    socket.on('webrtc_answer', (data) => {
        const { room, answer } = data;
        io.to(Number(room)).emit('webrtc_answer', answer); // Ensure room is a number
    });

    socket.on('webrtc_ice_candidate', (data) => {
        const { room, candidate } = data;
        io.to(Number(room)).emit('webrtc_ice_candidate', candidate); // Ensure room is a number
    });

    socket.on('doctor_accepts_consultation', (data) => {
        const { patientId, doctorId, doctorName } = data;
        const patientSocketId = onlinePatients[Number(patientId)];
        if (patientSocketId) {
            io.to(patientSocketId).emit('consultation_accepted', { doctorId, doctorName });
        } else {
            // Patient not online or socket ID not found
        }
    });

    socket.on('disconnect', () => {
        // Find and remove the doctor from onlineDoctors if they disconnect
        const disconnectedDoctorId = Object.keys(onlineDoctors).find(
            id => onlineDoctors[id].socketId === socket.id
        );
        if (disconnectedDoctorId) {
            delete onlineDoctors[disconnectedDoctorId];
        }

        // Find and remove the patient from onlinePatients if they disconnect
        const disconnectedPatientId = Object.keys(onlinePatients).find(
            id => onlinePatients[id] === socket.id
        );
        if (disconnectedPatientId) {
            delete onlinePatients[disconnectedPatientId];
        }
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
});

