const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');

const DBSOURCE = "telemedicine.db";

const db = new sqlite3.Database(DBSOURCE, (err) => {
    if (err) {
        // Cannot open database
        console.error(err.message);
        throw err;
    } else {
        console.log('Connected to the SQLite database.');
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            password TEXT,
            role TEXT,
            profession TEXT,
            CONSTRAINT username_unique UNIQUE (username)
        )`, (err) => {
            if (err) {
                console.error("Error creating users table", err);
            }
        });

        // Upsert admin user
        const saltRounds = 10;
        bcrypt.hash('password', saltRounds, (err, hash) => {
            if (err) {
                console.error("Error hashing password for admin user", err);
            } else {
                db.run(`INSERT INTO users (username, password, role) 
                        VALUES ('admin', ?, 'admin') 
                        ON CONFLICT(username) DO NOTHING`, 
                        [hash], 
                        (err) => {
                    if (err) {
                        console.error("Error creating admin user", err);
                    } else {
                        // This will either insert the admin or do nothing if it exists.
                        console.log("Admin user checked/created.");
                    }
                });
            }
        });
    }
});

module.exports = db;
