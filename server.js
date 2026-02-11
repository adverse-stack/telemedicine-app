console.log('Server started and running!');
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken'); // Import jsonwebtoken
const cookieParser = require('cookie-parser'); // Import cookie-parser
const db = require('./database.js');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;
const saltRounds = 10;
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwtkey'; // Default for local dev, ensure set in Render
// const onlineDoctors = {}; // In-memory store for online doctors - REMOVED
// const onlinePatients = {}; // In-memory store for online patients - REMOVED

// Middleware
app.use((req, res, next) => {
    next();
});
app.use(express.static('public'));
app.use(express.json());
app.use(cookieParser()); // Use cookie-parser middleware


// Authentication Middleware
const authenticateToken = (req, res, next) => {
    const token = req.cookies.token; // Get token from HttpOnly cookie
    console.log('[authenticateToken] Received token:', token ? 'YES' : 'NO');

    if (!token) {
        console.log('[authenticateToken] No token found, returning 401.');
        return res.status(401).json({ success: false, message: 'Authentication token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            console.log('[authenticateToken] Token verification failed:', err.message);
            res.clearCookie('token'); // Clear the invalid token cookie
            return res.status(403).json({ success: false, message: 'Invalid or expired token' });
        }
        req.userId = user.id;
        req.userRole = user.role;
        console.log(`[authenticateToken] Token verified. User ID: ${req.userId}, Role: ${req.userRole}`);
        next(); // Proceed to the next middleware/route handler
    });
};

// Authorization Middleware
const authorizeRoles = (allowedRoles) => {
    return (req, res, next) => {
        if (!req.userRole || !allowedRoles.includes(req.userRole)) {
            return res.status(403).json({ success: false, message: 'Forbidden: Insufficient permissions' });
        }
        next();
    };
};

// Prevent caching for API routes
app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
});

app.post('/api/logout', authenticateToken, (req, res) => {
    res.clearCookie('token');
    res.json({ success: true, message: 'Logged out successfully' });
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

// Endpoint to start a new conversation
app.post('/api/start-conversation', authenticateToken, authorizeRoles(['patient']), async (req, res) => {
    const { doctorId } = req.body;
    const patientId = req.userId; // Authenticated patient's ID

    if (!doctorId) {
        return res.status(400).json({ success: false, message: 'Missing doctorId' });
    }

    try {
        // Verify doctorId corresponds to an actual doctor
        const doctorCheck = await db.query('SELECT id FROM users WHERE id = $1 AND role = \'doctor\'', [doctorId]);
        if (doctorCheck.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Doctor not found.' });
        }

        // Check if a conversation already exists
        let conversationResult = await db.query(
            'SELECT id FROM conversations WHERE patient_id = $1 AND doctor_id = $2',
            [patientId, doctorId]
        );

        let conversationId;
        if (conversationResult.rows.length === 0) {
            // Create new conversation if none exists
            const newConv = await db.query(
                'INSERT INTO conversations (patient_id, doctor_id) VALUES ($1, $2) RETURNING id',
                [patientId, doctorId]
            );
            conversationId = newConv.rows[0].id;
        } else {
            conversationId = conversationResult.rows[0].id;
        }

        // Notify doctor of new patient request (if doctor is online)
        const doctorSocket = onlineDoctors[Number(doctorId)];
        if (doctorSocket && doctorSocket.socketId) {
            // Fetch patient name for notification
            const patientDetails = await db.query('SELECT username FROM users WHERE id = $1', [patientId]);
            const patientName = patientDetails.rows[0]?.username || 'Unknown Patient';

            io.to(doctorSocket.socketId).emit('new_patient_request', {
                patientId: patientId,
                patientName: patientName,
                conversationId: conversationId
            });
            console.log(`[SERVER] Emitted new_patient_request for patient ${patientName} (${patientId}) to doctor ${doctorSocket.username} (${doctorId})`);
        } else {
            console.log(`[SERVER] Doctor ${doctorId} not online, cannot emit new_patient_request.`);
        }


        res.json({ success: true, message: 'Conversation initiated', conversationId: conversationId });

    } catch (err) {
        console.error('Error starting conversation:', err);
        res.status(500).json({ success: false, message: 'Server error' });
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
                        // Generate JWT token
                        const token = jwt.sign(
                            { id: user.id, role: user.role },
                            JWT_SECRET,
                            { expiresIn: '1h' } // Token expires in 1 hour
                        );
        
                        // Set token as an HttpOnly cookie
                        res.cookie('token', token, {
                            httpOnly: true,
                            secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
                            maxAge: 3600000 // 1 hour in milliseconds
                        });
        
                        res.json({ success: true, message: 'Login successful' }); // Removed userId and role from direct response
                    } else {
                        res.status(401).json({ success: false, message: 'Invalid credentials' });
                    }    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.post('/api/admin/doctors', authenticateToken, authorizeRoles(['admin']), async (req, res) => {
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

app.get('/api/admin/doctors', authenticateToken, authorizeRoles(['admin']), async (req, res) => {
    try {
        const { rows } = await db.query('SELECT id, username, profession FROM users WHERE role = \'doctor\'');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.delete('/api/admin/doctors/:id', authenticateToken, authorizeRoles(['admin']), async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('DELETE FROM users WHERE id = $1 AND role = \'doctor\'', [id]);
        res.json({ success: true, message: 'Doctor deleted successfully.' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.get('/api/doctors', authenticateToken, (req, res) => {
    const { profession } = req.query;
    let availableDoctors = Object.values(onlineDoctors);

    if (profession) {
        // Case-insensitive filtering
        availableDoctors = availableDoctors.filter(doc => doc.profession.toLowerCase() === profession.toLowerCase());
    }
    
    res.json(availableDoctors);
});

app.get('/api/doctor/patients', authenticateToken, authorizeRoles(['doctor']), async (req, res) => {
    const { doctorId } = req.query;
    // Ensure the doctorId in query matches the authenticated doctor's ID
    if (Number(doctorId) !== req.userId) {
        return res.status(403).json({ success: false, message: 'Forbidden: You can only view your own patients.' });
    }
    try {
        const { rows } = await db.query(
            `SELECT u.id, u.username
             FROM users u
             JOIN conversations c ON u.id = c.patient_id
             WHERE c.doctor_id = $1 AND u.role = 'patient'`,
            [doctorId]
        );
        // Filter to include only online patients and get their current status
        const patientsWithOnlineStatus = rows.map(patient => {
            const onlinePatient = onlinePatients[patient.id];
            return {
                id: patient.id,
                username: patient.username,
                isOnline: !!onlinePatient // True if onlinePatient exists
            };
        }).filter(patient => patient.isOnline); // Only keep online patients

        res.json(patientsWithOnlineStatus);
    } catch (err) {
        console.error('Error fetching doctor patients:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});





// Socket.IO authentication middleware
io.use((socket, next) => {
    const cookies = require('cookie').parse(socket.request.headers.cookie || '');
    const token = cookies.token;

    if (!token) {
        return next(new Error('Authentication error: Token missing'));
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return next(new Error('Authentication error: Invalid token'));
        }
        socket.userId = decoded.id;
        socket.userRole = decoded.role;
        next();
    });
});

// Socket.IO Connection Handling
io.on('connection', (socket) => {
    socket.on('doctor_joins', async () => { // Removed data parameter as userId is now from authenticated socket
        if (socket.userRole !== 'doctor') {
            console.warn(`[SERVER] Unauthorized user (Role: ${socket.userRole}) attempted to join as doctor.`);
            return;
        }
        const doctorNumId = socket.userId; 
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

    socket.on('patient_joins', async () => { // Removed data parameter as patientId is now from authenticated socket
        if (socket.userRole !== 'patient') {
            console.warn(`[SERVER] Unauthorized user (Role: ${socket.userRole}) attempted to join as patient.`);
            return;
        }
        const patientNumId = socket.userId;
        try {
            // Fetch patient details from DB
            const { rows } = await db.query('SELECT id, username FROM users WHERE id = $1 AND role = \'patient\'', [patientNumId]);
            const patient = rows[0];
            if (patient) {
                onlinePatients[patient.id] = { ...patient, socketId: socket.id };
                console.log(`[SERVER] Patient ${patient.username} (${patient.id}) joined. Stored in onlinePatients:`, onlinePatients[patient.id]);
                console.log('[SERVER] Current onlinePatients:', Object.keys(onlinePatients)); // Log all online patient IDs
            }
        } catch (err) {
            console.error('Error fetching patient details:', err);
        }
    });

    socket.on('patient_requests_consultation', async (data) => {
        if (socket.userRole !== 'patient') {
            console.warn(`[SERVER] Unauthorized user (Role: ${socket.userRole}) attempted to request consultation.`);
            return;
        }
        const patientId = socket.userId; // Use authenticated patient ID
        const { patientName, doctorId, doctorName } = data; // patientName, doctorId, doctorName still come from client, but patientId is verified.
        console.log(`[SERVER] Patient ${patientName} (${patientId}) requests consultation with Doctor ${doctorName} (${doctorId}).`);
        try {
            // Check if conversation already exists
            let conversationId;
            console.log(`[SERVER] Checking for existing conversation for patient ${patientId} and doctor ${doctorId}`);
            const { rows } = await db.query(
                'SELECT id FROM conversations WHERE patient_id = $1 AND doctor_id = $2',
                [patientId, doctorId]
            );
            console.log(`[SERVER] Existing conversation query result:`, rows);

            if (rows.length === 0) {
                console.log(`[SERVER] No existing conversation. Creating new one.`);
                // Create new conversation
                const newConv = await db.query(
                    'INSERT INTO conversations (patient_id, doctor_id) VALUES ($1, $2) RETURNING id',
                    [patientId, doctorId]
                );
                conversationId = newConv.rows[0].id;
                console.log(`[SERVER] New conversation created with ID: ${conversationId}`);
            } else {
                conversationId = rows[0].id;
                console.log(`[SERVER] Found existing conversation with ID: ${conversationId}`);
            }
            
            console.log(`[SERVER] Final conversationId before emitting new_patient_request: ${conversationId}`);

            // Notify doctor of new patient request
            const doctorSocket = onlineDoctors[Number(doctorId)];
            if (doctorSocket && doctorSocket.socketId) {
                io.to(doctorSocket.socketId).emit('new_patient_request', {
                    patientId: patientId,
                    patientName: patientName,
                    conversationId: conversationId
                });
                console.log(`[SERVER] Emitted new_patient_request for patient ${patientName} (${patientId}) to doctor ${doctorSocket.username} (${doctorId})`);
            } else {
                console.log(`[SERVER] Doctor ${doctorId} not online, cannot emit new_patient_request.`);
            }
        } catch (err) {
            console.error('Error handling patient_requests_consultation:', err);
        }
    });

    socket.on('join', (room) => {
        socket.join(room);
        console.log(`[SERVER] Socket ${socket.id} joined room ${room}`);
    });

    socket.on('chat_message', async (data) => {
        const { room, message } = data; // room and message still from client
        const senderId = socket.userId; // Use authenticated sender ID
        const numericRoom = Number(room); // Ensure room is a number
        const numericSenderId = Number(senderId); // Ensure senderId is a number

        try {
            // Save message to database
            await db.query(
                'INSERT INTO messages (conversation_id, sender_id, message_content) VALUES ($1, $2, $3)',
                [numericRoom, numericSenderId, message]
            );
            io.to(numericRoom).emit('chat_message', { senderId: numericSenderId, message, conversationId: numericRoom, timestamp: new Date() });
            console.log(`[SERVER] Chat message from ${senderId} to room ${room}: ${message}`);
        } catch (err) {
            console.error('Error broadcasting or saving chat message:', err);
        }
    });
    
    // WebRTC Signaling
    socket.on('webrtc_offer', (data) => {
        const { room } = data;
        io.to(Number(room)).emit('webrtc_offer', data); // Ensure room is a number for Socket.IO room
        console.log(`[SERVER] WebRTC offer for room ${room}`);
    });

    socket.on('webrtc_answer', (data) => {
        const { room, answer } = data;
        io.to(Number(room)).emit('webrtc_answer', answer); // Ensure room is a number
        console.log(`[SERVER] WebRTC answer for room ${room}`);
    });

    socket.on('webrtc_ice_candidate', (data) => {
        const { room, candidate } = data;
        io.to(Number(room)).emit('webrtc_ice_candidate', candidate); // Ensure room is a number
        console.log(`[SERVER] WebRTC ICE candidate for room ${room}`);
    });

    socket.on('doctor_accepts_consultation', (data) => {
        if (socket.userRole !== 'doctor') {
            console.warn(`[SERVER] Unauthorized user (Role: ${socket.userRole}) attempted to accept consultation.`);
            return;
        }
        const doctorId = socket.userId; // Use authenticated doctor ID
        console.log('[SERVER] Raw data received by doctor_accepts_consultation:', data); // Add this line
        const { patientId, doctorName, conversationId } = data; // patientId, doctorName, conversationId still come from client, but doctorId is verified.
        console.log(`[SERVER] Doctor ${doctorName} (${doctorId}) accepts consultation for patient ${patientId} (Conversation: ${conversationId})`);
        
        const patientNumId = Number(patientId);
        console.log(`[SERVER] Attempting to find patient socket for patientId: ${patientNumId}. Current onlinePatients keys:`, Object.keys(onlinePatients));
        
        const patientSocket = onlinePatients[patientNumId];
        console.log(`[SERVER] patientSocket found:`, patientSocket);

        if (patientSocket && patientSocket.socketId) {
            io.to(patientSocket.socketId).emit('consultation_accepted', { doctorId, doctorName, conversationId });
            console.log(`[SERVER] Emitted consultation_accepted to patient ${patientId} (socket: ${patientSocket.socketId})`);
        } else {
            console.log(`[SERVER] Patient ${patientId} not online or socket ID not found. patientSocket:`, patientSocket);
        }
    });

    socket.on('disconnect', () => {
        // Find and remove the doctor from onlineDoctors if they disconnect
        const disconnectedDoctorId = Object.keys(onlineDoctors).find(
            id => onlineDoctors[id].socketId === socket.id
        );
        if (disconnectedDoctorId) {
            delete onlineDoctors[disconnectedDoctorId];
            console.log(`[SERVER] Doctor ${disconnectedDoctorId} disconnected. Current onlineDoctors:`, Object.keys(onlineDoctors));
        }

        // Find and remove the patient from onlinePatients if they disconnect
        const disconnectedPatientId = Object.keys(onlinePatients).find(
            id => onlinePatients[id]?.socketId === socket.id
        );
        if (disconnectedPatientId) {
            delete onlinePatients[disconnectedPatientId];
            console.log(`[SERVER] Patient ${disconnectedPatientId} disconnected. Current onlinePatients:`, Object.keys(onlinePatients));
        }
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
});

module.exports = app;

