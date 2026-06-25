const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const mysql = require('mysql2/promise');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = 3000;

const MYSQL_CONFIG = {
    host: process.env.MYSQL_HOST || 'localhost',
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'veronic_fleet'
};

let mysqlPool = null;

async function createMySQLDatabaseIfMissing() {
    const { host, user, password, database } = MYSQL_CONFIG;
    const tempPool = await mysql.createPool({ host, user, password, waitForConnections: true, connectionLimit: 1, queueLimit: 0 });
    await tempPool.query(`CREATE DATABASE IF NOT EXISTS \`${database}\``);
    await tempPool.end();
}

async function initializeMySQL() {
    try {
        await createMySQLDatabaseIfMissing();
        mysqlPool = await mysql.createPool({
            host: MYSQL_CONFIG.host,
            user: MYSQL_CONFIG.user,
            password: MYSQL_CONFIG.password,
            database: MYSQL_CONFIG.database,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        });
        await mysqlPool.execute(`
            CREATE TABLE IF NOT EXISTS today_driver_assignments (
                id INT AUTO_INCREMENT PRIMARY KEY,
                bus_id INT NOT NULL,
                driver_id INT NOT NULL,
                assigned_date DATE NOT NULL,
                assigned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY uniq_bus_date (bus_id, assigned_date),
                UNIQUE KEY uniq_driver_date (driver_id, assigned_date)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        console.log('Connected to MySQL and ensured today_driver_assignments table exists');
    } catch (err) {
        mysqlPool = null;
        console.error('Failed to initialize MySQL today driver assignments:', err.message);
    }
}

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

function startServer() {
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

// Database connection
const db = new sqlite3.Database('./veronic_fleet.db', async (err) => {
    if (err) {
        console.error('Error connecting to database:', err.message);
    } else {
        console.log('Connected to SQLite database');
        initializeDatabase();
        createAuthTables();
        await initializeMySQL();
        startServer();
    }
});

function dbRun(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
}

function dbGet(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function dbAll(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

// Initialize database tables
function initializeDatabase() {
    // Create drivers table
    db.run(`
        CREATE TABLE IF NOT EXISTS drivers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            mobile TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Create deleted_drivers table
    db.run(`
        CREATE TABLE IF NOT EXISTS deleted_drivers (
            id INTEGER,
            name TEXT NOT NULL,
            mobile TEXT,
            created_at DATETIME,
            deleted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            deleted_by TEXT DEFAULT 'user'
        )
    `);

    // Create buses table
    db.run(`
        CREATE TABLE IF NOT EXISTS buses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            bus_number TEXT NOT NULL UNIQUE,
            assigned_driver_id INTEGER,
            status TEXT DEFAULT 'Active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (assigned_driver_id) REFERENCES drivers(id) ON DELETE SET NULL
        )
    `);

    // Create deleted_buses table
    db.run(`
        CREATE TABLE IF NOT EXISTS deleted_buses (
            id INTEGER,
            bus_number TEXT NOT NULL,
            assigned_driver_id INTEGER,
            status TEXT,
            created_at DATETIME,
            deleted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            deleted_by TEXT DEFAULT 'user'
        )
    `);

    // Create bills table
    db.run(`
        CREATE TABLE IF NOT EXISTS bills (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            bill_no TEXT NOT NULL UNIQUE,
            date DATE NOT NULL,
            driver_name TEXT,
            bus_no TEXT,
            moklnar_name TEXT,
            moklnar_mobile TEXT,
            lenar_name TEXT,
            lenar_mobile TEXT,
            total REAL DEFAULT 0,
            jama REAL DEFAULT 0,
            baki REAL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Create today driver assignments table
    db.run(`
        CREATE TABLE IF NOT EXISTS today_driver_assignments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            bus_id INTEGER NOT NULL,
            driver_id INTEGER NOT NULL,
            assigned_date DATE NOT NULL DEFAULT CURRENT_DATE,
            assigned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (bus_id) REFERENCES buses(id) ON DELETE CASCADE,
            FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE,
            UNIQUE (bus_id, assigned_date),
            UNIQUE (driver_id, assigned_date)
        )
    `);

    // Create deleted_bills table
    db.run(`
        CREATE TABLE IF NOT EXISTS deleted_bills (
            id INTEGER,
            bill_no TEXT NOT NULL,
            date DATE NOT NULL,
            driver_name TEXT,
            bus_no TEXT,
            moklnar_name TEXT,
            moklnar_mobile TEXT,
            lenar_name TEXT,
            lenar_mobile TEXT,
            total REAL DEFAULT 0,
            jama REAL DEFAULT 0,
            baki REAL DEFAULT 0,
            created_at DATETIME,
            deleted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            deleted_by TEXT DEFAULT 'user'
        )
    `);

    // Create bill_items table
    db.run(`
        CREATE TABLE IF NOT EXISTS bill_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            bill_id INTEGER NOT NULL,
            from_city TEXT DEFAULT 'Rajkot',
            to_city TEXT DEFAULT 'Surat',
            description TEXT,
            qty INTEGER DEFAULT 1,
            remark TEXT,
            amount REAL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE
        )
    `);

    // Create deleted_bill_items table
    db.run(`
        CREATE TABLE IF NOT EXISTS deleted_bill_items (
            id INTEGER,
            bill_id INTEGER,
            from_city TEXT DEFAULT 'Rajkot',
            to_city TEXT DEFAULT 'Surat',
            description TEXT,
            qty INTEGER DEFAULT 1,
            remark TEXT,
            amount REAL DEFAULT 0,
            created_at DATETIME,
            deleted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            deleted_by TEXT DEFAULT 'user'
        )
    `);

    // Insert sample data if tables are empty
    db.get("SELECT COUNT(*) as count FROM drivers", (err, row) => {
        if (err) {
            console.error('Error checking drivers:', err);
            return;
        }
        if (row.count === 0) {
            insertSampleData();
        }
    });
}

// Insert sample data
function insertSampleData() {
    const sampleDrivers = [
        ['Vijay Odedra', '9510075279'],
        ['Vansh Rabari', '9876543210'],
        ['Ramesh Makwana', '9988776655'],
        ['vashu odedra', '9909989890'],
        ['vijay', '1234567890'],
        ['vashu', '456789123'],
        ['chirag', '124578963'],
        ['vivek', '2589648723']
    ];

    const stmt = db.prepare("INSERT INTO drivers (name, mobile) VALUES (?, ?)");
    sampleDrivers.forEach(driver => {
        stmt.run(driver[0], driver[1]);
    });
    stmt.finalize();

    // Insert sample buses
    const sampleBuses = [
        ['GJ-01-LTZ1162', 2, 'Active'],
        ['GJ-01-LTZ1163', 8, 'Active'],
        ['GJ-01-LTZ1166', 7, 'Active']
    ];

    const busStmt = db.prepare("INSERT INTO buses (bus_number, assigned_driver_id, status) VALUES (?, ?, ?)");
    sampleBuses.forEach(bus => {
        busStmt.run(bus[0], bus[1], bus[2]);
    });
    busStmt.finalize();

    // Insert sample bills
    const sampleBills = [
        ['VER-8766', '2026-06-17', 'Ramesh Makwana', 'GJ-01-LTZ1162', 'vijay odedra', '9510075279', 'vansh', '9909876756', 50000, 50000, 20000],
        ['VER-3348', '2026-06-18', 'chirag', 'GJ-01-LTZ1163', 'shujal', '9825840119', 'ram', '9825840819', 5000, 5000, 1000],
        ['VER-8027', '2026-06-18', 'vashu odedra', 'GJ-01-LTZ1166', 'raju', '7878929391', 'ram', '8909878667', 50000, 50000, 10000],
        ['VER-6514', '2026-06-18', 'vivek', 'GJ-01-LTZ1163', 'ramesh', '215489637', 'rohan', '369852147', 20000, 20000, 50000],
        ['VER-3308', '2026-06-18', 'Ramesh Makwana', 'GJ-01-LTZ1166', 'viren', '6789012345', 'radhika', '5678901234', 50000, 50000, 10000],
        ['VER-2546', '2026-06-18', 'vivek', 'GJ-01-LTZ1166', 'shujal', '6789501234', 'chagan', '1222134564', 10000, 10000, 20000],
        ['BHAN-001', '2026-06-18', 'vashu', 'GJ-01-LTZ1166', 'harshil', '2365897410', 'shujal', '124587963', 25000, 25000, 5000],
        ['BHAN-002', '2026-06-18', 'vijay', 'GJ-01-LTZ1166', 'ridhi', '5421098765', 'roshni', '2345654378', 50000, 50000, 10000]
    ];

    const billStmt = db.prepare("INSERT INTO bills (bill_no, date, driver_name, bus_no, moklnar_name, moklnar_mobile, lenar_name, lenar_mobile, total, jama, baki) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    sampleBills.forEach((bill, index) => {
        billStmt.run(bill[0], bill[1], bill[2], bill[3], bill[4], bill[5], bill[6], bill[7], bill[8], bill[9], bill[10], function(err) {
            if (!err && this.lastID) {
                // Insert sample bill items
                const items = [
                    ['Rajkot', 'Surat', 'Electronics', 10, 'Fragile', 50000],
                    ['Rajkot', 'Surat', 'Documents', 1, 'Urgent', 5000],
                    ['Rajkot', 'Surat', 'Furniture', 10, 'Heavy', 50000],
                    ['Rajkot', 'Surat', 'Clothes', 200, 'Packages', 20000],
                    ['Rajkot', 'Surat', 'Electronics', 10, 'Fragile', 50000],
                    ['Rajkot', 'Surat', 'Food Items', 100, 'Perishable', 10000],
                    ['Rajkot', 'Surat', 'Books', 5, 'Fragile', 25000],
                    ['Rajkot', 'Surat', 'Medicine', 20, 'Urgent', 50000]
                ];
                const itemStmt = db.prepare("INSERT INTO bill_items (bill_id, from_city, to_city, description, qty, remark, amount) VALUES (?, ?, ?, ?, ?, ?, ?)");
                if (items[index]) {
                    const item = items[index];
                    itemStmt.run(this.lastID, item[0], item[1], item[2], item[3], item[4], item[5]);
                }
                itemStmt.finalize();
            }
        });
    });
    billStmt.finalize();

    console.log('Sample data inserted successfully');
}

// ==============================================
// AUTHENTICATION TABLES
// ==============================================

function createAuthTables() {
    // Create users table
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `, (err) => {
        if (err) {
            console.error('Error creating users table:', err.message);
        } else {
            console.log('✅ Users table ready');
            insertDemoUsers();
        }
    });

    // Create sessions table
    db.run(`
        CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            token TEXT UNIQUE NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            expires_at DATETIME,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `, (err) => {
        if (err) {
            console.error('Error creating sessions table:', err.message);
        } else {
            console.log('✅ Sessions table ready');
        }
    });
}

// Insert demo users
function insertDemoUsers() {
    db.get("SELECT COUNT(*) as count FROM users", (err, row) => {
        if (err) {
            console.error('Error checking users:', err.message);
            return;
        }
        if (row.count === 0) {
            const demoUsers = [
                ['Admin', 'admin@veronic.com', 'admin123'],
                ['Demo User', 'demo@example.com', 'demo'],
                ['Simple User', 'user@simple.com', '123']
            ];
            
            const stmt = db.prepare("INSERT INTO users (name, email, password) VALUES (?, ?, ?)");
            demoUsers.forEach(([name, email, password]) => {
                stmt.run(name, email, password, (err) => {
                    if (err) {
                        console.error(`Error inserting demo user ${email}:`, err.message);
                    } else {
                        console.log(`✅ Demo user "${email}" inserted`);
                    }
                });
            });
            stmt.finalize();
        }
    });
}

// ==============================================
// AUTHENTICATION HELPER FUNCTIONS
// ==============================================

function findUserByEmail(email) {
    return new Promise((resolve, reject) => {
        db.get("SELECT * FROM users WHERE email = ?", [email], (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function findUserById(id) {
    return new Promise((resolve, reject) => {
        db.get("SELECT id, name, email, created_at FROM users WHERE id = ?", [id], (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function createUser(name, email, password) {
    return new Promise((resolve, reject) => {
        db.run("INSERT INTO users (name, email, password) VALUES (?, ?, ?)", [name, email, password], function(err) {
            if (err) reject(err);
            else resolve({ id: this.lastID, name, email });
        });
    });
}

function validateUser(email, password) {
    return new Promise((resolve, reject) => {
        db.get("SELECT * FROM users WHERE email = ? AND password = ?", [email, password], (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function createSession(userId, token) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    
    return new Promise((resolve, reject) => {
        db.run("INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)", 
            [userId, token, expiresAt.toISOString()], 
            function(err) {
                if (err) reject(err);
                else resolve({ id: this.lastID, userId, token });
            }
        );
    });
}

function validateSession(token) {
    return new Promise((resolve, reject) => {
        db.get(
            `SELECT s.*, u.name, u.email 
             FROM sessions s 
             JOIN users u ON s.user_id = u.id 
             WHERE s.token = ? AND s.expires_at > datetime('now')`,
            [token],
            (err, row) => {
                if (err) reject(err);
                else resolve(row);
            }
        );
    });
}

function deleteSession(token) {
    return new Promise((resolve, reject) => {
        db.run("DELETE FROM sessions WHERE token = ?", [token], function(err) {
            if (err) reject(err);
            else resolve(this.changes > 0);
        });
    });
}

function generateToken() {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15) + 
           Date.now().toString(36);
}

// ==============================================
// AUTHENTICATION ROUTES
// ==============================================

// ===== SIGNUP =====
app.post('/api/signup', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        
        if (!name || !email || !password) {
            return res.status(400).json({ 
                success: false, 
                message: 'All fields are required' 
            });
        }
        
        if (password.length < 3) {
            return res.status(400).json({ 
                success: false, 
                message: 'Password must be at least 3 characters' 
            });
        }
        
        const existingUser = await findUserByEmail(email);
        if (existingUser) {
            return res.status(409).json({ 
                success: false, 
                message: 'User already exists with this email' 
            });
        }
        
        const newUser = await createUser(name, email, password);
        const token = generateToken();
        await createSession(newUser.id, token);
        
        res.status(201).json({
            success: true,
            message: 'Account created successfully',
            data: { 
                user: { 
                    id: newUser.id, 
                    name: newUser.name, 
                    email: newUser.email 
                }, 
                token 
            }
        });
        
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error' 
        });
    }
});

// ===== LOGIN =====
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ 
                success: false, 
                message: 'Email and password are required' 
            });
        }
        
        const user = await validateUser(email, password);
        if (!user) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid credentials. Please check your email and password.' 
            });
        }
        
        const token = generateToken();
        await createSession(user.id, token);
        
        const { password: _, ...userWithoutPassword } = user;
        
        res.json({
            success: true,
            message: 'Login successful',
            data: { 
                user: userWithoutPassword, 
                token 
            }
        });
        
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error' 
        });
    }
});

// ===== LOGOUT =====
app.post('/api/logout', async (req, res) => {
    try {
        const { token } = req.body;
        if (!token) {
            return res.status(400).json({ 
                success: false, 
                message: 'Token is required' 
            });
        }
        const deleted = await deleteSession(token);
        res.json({ 
            success: true, 
            message: deleted ? 'Logged out successfully' : 'Session not found' 
        });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error' 
        });
    }
});

// ===== VERIFY SESSION =====
app.get('/api/verify', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ 
                success: false, 
                message: 'No token provided' 
            });
        }
        const session = await validateSession(token);
        if (!session) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid or expired session' 
            });
        }
        res.json({
            success: true,
            message: 'Session valid',
            data: { 
                user: { 
                    id: session.user_id, 
                    name: session.name, 
                    email: session.email 
                } 
            }
        });
    } catch (error) {
        console.error('Verify error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error' 
        });
    }
});

// ===== GET USER PROFILE =====
app.get('/api/profile', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ 
                success: false, 
                message: 'No token provided' 
            });
        }
        const session = await validateSession(token);
        if (!session) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid or expired session' 
            });
        }
        const user = await findUserById(session.user_id);
        res.json({ 
            success: true, 
            data: { user } 
        });
    } catch (error) {
        console.error('Profile error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error' 
        });
    }
});

// ===== GET ALL USERS =====
app.get('/api/users/all', async (req, res) => {
    try {
        db.all('SELECT id, name, email, created_at FROM users ORDER BY created_at DESC', (err, rows) => {
            if (err) {
                return res.status(500).json({ 
                    success: false, 
                    message: 'Database error' 
                });
            }
            res.json({ 
                success: true, 
                data: { users: rows } 
            });
        });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error' 
        });
    }
});

// ===== CHECK IF USER EXISTS =====
app.post('/api/check-user', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ 
                success: false, 
                message: 'Email is required' 
            });
        }
        const user = await findUserByEmail(email);
        res.json({ 
            success: true, 
            data: { exists: !!user } 
        });
    } catch (error) {
        console.error('Check user error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error' 
        });
    }
});

// ===== UPDATE PASSWORD =====
app.put('/api/update-password', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        const { currentPassword, newPassword } = req.body;
        
        if (!token) {
            return res.status(401).json({ 
                success: false, 
                message: 'No token provided' 
            });
        }
        
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ 
                success: false, 
                message: 'Current and new password are required' 
            });
        }
        
        if (newPassword.length < 3) {
            return res.status(400).json({ 
                success: false, 
                message: 'New password must be at least 3 characters' 
            });
        }
        
        const session = await validateSession(token);
        if (!session) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid or expired session' 
            });
        }
        
        const user = await validateUser(session.email, currentPassword);
        if (!user) {
            return res.status(401).json({ 
                success: false, 
                message: 'Current password is incorrect' 
            });
        }
        
        db.run("UPDATE users SET password = ? WHERE id = ?", [newPassword, session.user_id], function(err) {
            if (err) {
                return res.status(500).json({ 
                    success: false, 
                    message: 'Database error' 
                });
            }
            res.json({ 
                success: true, 
                message: 'Password updated successfully' 
            });
        });
    } catch (error) {
        console.error('Update password error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error' 
        });
    }
});

// ===== DELETE USER ACCOUNT =====
app.delete('/api/delete-account', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        const { password } = req.body;
        
        if (!token) {
            return res.status(401).json({ 
                success: false, 
                message: 'No token provided' 
            });
        }
        
        if (!password) {
            return res.status(400).json({ 
                success: false, 
                message: 'Password is required to delete account' 
            });
        }
        
        const session = await validateSession(token);
        if (!session) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid or expired session' 
            });
        }
        
        const user = await validateUser(session.email, password);
        if (!user) {
            return res.status(401).json({ 
                success: false, 
                message: 'Password is incorrect' 
            });
        }
        
        await deleteSession(token);
        
        db.run("DELETE FROM users WHERE id = ?", [session.user_id], function(err) {
            if (err) {
                return res.status(500).json({ 
                    success: false, 
                    message: 'Database error' 
                });
            }
            res.json({ 
                success: true, 
                message: 'Account deleted successfully' 
            });
        });
    } catch (error) {
        console.error('Delete account error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error' 
        });
    }
});

// ============ HELPER FUNCTIONS FOR SOFT DELETE ============

// Soft delete driver - move to deleted_drivers table
function softDeleteDriver(id, callback) {
    // First get the driver data
    db.get("SELECT * FROM drivers WHERE id = ?", [id], (err, driver) => {
        if (err) {
            callback(err);
            return;
        }
        if (!driver) {
            callback(new Error('Driver not found'));
            return;
        }

        // Insert into deleted_drivers
        db.run(`
            INSERT INTO deleted_drivers (id, name, mobile, created_at, deleted_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        `, [driver.id, driver.name, driver.mobile, driver.created_at], (err) => {
            if (err) {
                callback(err);
                return;
            }

            // Update buses to remove assigned driver
            db.run("UPDATE buses SET assigned_driver_id = NULL WHERE assigned_driver_id = ?", [id], (err) => {
                if (err) {
                    callback(err);
                    return;
                }

                // Delete from drivers
                db.run("DELETE FROM drivers WHERE id = ?", [id], (err) => {
                    if (err) {
                        callback(err);
                        return;
                    }
                    callback(null, { message: 'Driver moved to deleted records' });
                });
            });
        });
    });
}

// Soft delete bus - move to deleted_buses table
function softDeleteBus(id, callback) {
    db.get("SELECT * FROM buses WHERE id = ?", [id], (err, bus) => {
        if (err) {
            callback(err);
            return;
        }
        if (!bus) {
            callback(new Error('Bus not found'));
            return;
        }

        db.run(`
            INSERT INTO deleted_buses (id, bus_number, assigned_driver_id, status, created_at, deleted_at)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `, [bus.id, bus.bus_number, bus.assigned_driver_id, bus.status, bus.created_at], (err) => {
            if (err) {
                callback(err);
                return;
            }

            db.run("DELETE FROM buses WHERE id = ?", [id], (err) => {
                if (err) {
                    callback(err);
                    return;
                }
                callback(null, { message: 'Bus moved to deleted records' });
            });
        });
    });
}

// Soft delete bill - move to deleted_bills and delete items
function softDeleteBill(id, callback) {
    // First get the bill data with items
    db.get("SELECT * FROM bills WHERE id = ?", [id], (err, bill) => {
        if (err) {
            callback(err);
            return;
        }
        if (!bill) {
            callback(new Error('Bill not found'));
            return;
        }

        // Get bill items
        db.all("SELECT * FROM bill_items WHERE bill_id = ?", [id], (err, items) => {
            if (err) {
                callback(err);
                return;
            }

            // Insert bill into deleted_bills
            db.run(`
                INSERT INTO deleted_bills (id, bill_no, date, driver_name, bus_no, moklnar_name, moklnar_mobile, lenar_name, lenar_mobile, total, jama, baki, created_at, deleted_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `, [bill.id, bill.bill_no, bill.date, bill.driver_name, bill.bus_no, bill.moklnar_name, bill.moklnar_mobile, bill.lenar_name, bill.lenar_mobile, bill.total, bill.jama, bill.baki, bill.created_at], (err) => {
                if (err) {
                    callback(err);
                    return;
                }

                // Insert items into deleted_bill_items
                if (items && items.length > 0) {
                    const itemStmt = db.prepare(`
                        INSERT INTO deleted_bill_items (id, bill_id, from_city, to_city, description, qty, remark, amount, created_at, deleted_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                    `);
                    items.forEach(item => {
                        itemStmt.run(item.id, item.bill_id, item.from_city, item.to_city, item.description, item.qty, item.remark, item.amount, item.created_at);
                    });
                    itemStmt.finalize();
                }

                // Delete from bills (items will be deleted by CASCADE)
                db.run("DELETE FROM bills WHERE id = ?", [id], (err) => {
                    if (err) {
                        callback(err);
                        return;
                    }
                    callback(null, { message: 'Bill moved to deleted records' });
                });
            });
        });
    });
}

// ============ API ROUTES ============

// ===== DRIVERS =====

// Get all drivers
app.get('/api/drivers', (req, res) => {
    db.all("SELECT * FROM drivers ORDER BY name", (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Get deleted drivers
app.get('/api/deleted/drivers', (req, res) => {
    db.all("SELECT * FROM deleted_drivers ORDER BY deleted_at DESC", (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Get single driver
app.get('/api/drivers/:id', (req, res) => {
    const { id } = req.params;
    db.get("SELECT * FROM drivers WHERE id = ?", [id], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (!row) {
            res.status(404).json({ error: 'Driver not found' });
            return;
        }
        res.json(row);
    });
});

// Add driver
app.post('/api/drivers', (req, res) => {
    const { name, mobile } = req.body;
    if (!name) {
        res.status(400).json({ error: 'Name is required' });
        return;
    }
    db.run("INSERT INTO drivers (name, mobile) VALUES (?, ?)", [name, mobile || ''], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ id: this.lastID, name, mobile });
    });
});

// Update driver
app.put('/api/drivers/:id', (req, res) => {
    const { id } = req.params;
    const { name, mobile } = req.body;
    if (!name) {
        res.status(400).json({ error: 'Name is required' });
        return;
    }
    db.run("UPDATE drivers SET name = ?, mobile = ? WHERE id = ?", [name, mobile || '', id], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (this.changes === 0) {
            res.status(404).json({ error: 'Driver not found' });
            return;
        }
        res.json({ id: parseInt(id), name, mobile });
    });
});

// Delete driver (Soft Delete)
app.delete('/api/drivers/:id', (req, res) => {
    const { id } = req.params;
    softDeleteDriver(id, (err, result) => {
        if (err) {
            if (err.message === 'Driver not found') {
                res.status(404).json({ error: err.message });
            } else {
                res.status(500).json({ error: err.message });
            }
            return;
        }
        res.json(result);
    });
});

// Restore deleted driver
app.post('/api/deleted/drivers/:id/restore', (req, res) => {
    const { id } = req.params;
    db.get("SELECT * FROM deleted_drivers WHERE id = ?", [id], (err, driver) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (!driver) {
            res.status(404).json({ error: 'Deleted driver not found' });
            return;
        }

        // Check if driver with same ID exists
        db.get("SELECT id FROM drivers WHERE id = ?", [id], (err, existing) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            if (existing) {
                // If ID exists, insert without ID
                db.run("INSERT INTO drivers (name, mobile, created_at) VALUES (?, ?, ?)", 
                    [driver.name, driver.mobile, driver.created_at], function(err) {
                    if (err) {
                        res.status(500).json({ error: err.message });
                        return;
                    }
                    db.run("DELETE FROM deleted_drivers WHERE id = ?", [id], (err) => {
                        if (err) {
                            res.status(500).json({ error: err.message });
                            return;
                        }
                        res.json({ message: 'Driver restored successfully', newId: this.lastID });
                    });
                });
            } else {
                // Insert with original ID
                db.run("INSERT INTO drivers (id, name, mobile, created_at) VALUES (?, ?, ?, ?)", 
                    [driver.id, driver.name, driver.mobile, driver.created_at], function(err) {
                    if (err) {
                        res.status(500).json({ error: err.message });
                        return;
                    }
                    db.run("DELETE FROM deleted_drivers WHERE id = ?", [id], (err) => {
                        if (err) {
                            res.status(500).json({ error: err.message });
                            return;
                        }
                        res.json({ message: 'Driver restored successfully' });
                    });
                });
            }
        });
    });
});

// ===== BUSES =====

// Get all buses with driver names
app.get('/api/buses', (req, res) => {
    db.all(`
        SELECT b.*, d.name as driver_name 
        FROM buses b
        LEFT JOIN drivers d ON b.assigned_driver_id = d.id
        ORDER BY b.bus_number
    `, (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Get deleted buses
app.get('/api/deleted/buses', (req, res) => {
    db.all("SELECT * FROM deleted_buses ORDER BY deleted_at DESC", (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Get single bus
app.get('/api/buses/:id', (req, res) => {
    const { id } = req.params;
    db.get(`
        SELECT b.*, d.name as driver_name 
        FROM buses b
        LEFT JOIN drivers d ON b.assigned_driver_id = d.id
        WHERE b.id = ?
    `, [id], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (!row) {
            res.status(404).json({ error: 'Bus not found' });
            return;
        }
        res.json(row);
    });
});

// Add bus
app.post('/api/buses', (req, res) => {
    const { busNumber, assignedDriverId } = req.body;
    if (!busNumber) {
        res.status(400).json({ error: 'Bus number is required' });
        return;
    }
    db.run("INSERT INTO buses (bus_number, assigned_driver_id, status) VALUES (?, ?, 'Active')", 
        [busNumber, assignedDriverId || null], function(err) {
        if (err) {
            if (err.message.includes('UNIQUE')) {
                res.status(400).json({ error: 'Bus number already exists' });
            } else {
                res.status(500).json({ error: err.message });
            }
            return;
        }
        res.json({ id: this.lastID, busNumber, assignedDriverId });
    });
});

// Update bus
app.put('/api/buses/:id', (req, res) => {
    const { id } = req.params;
    const { busNumber, assignedDriverId, status } = req.body;
    if (!busNumber) {
        res.status(400).json({ error: 'Bus number is required' });
        return;
    }
    db.run("UPDATE buses SET bus_number = ?, assigned_driver_id = ?, status = ? WHERE id = ?", 
        [busNumber, assignedDriverId || null, status || 'Active', id], function(err) {
        if (err) {
            if (err.message.includes('UNIQUE')) {
                res.status(400).json({ error: 'Bus number already exists' });
            } else {
                res.status(500).json({ error: err.message });
            }
            return;
        }
        if (this.changes === 0) {
            res.status(404).json({ error: 'Bus not found' });
            return;
        }
        res.json({ id: parseInt(id), busNumber, assignedDriverId });
    });
});

// Delete bus (Soft Delete)
app.delete('/api/buses/:id', (req, res) => {
    const { id } = req.params;
    softDeleteBus(id, (err, result) => {
        if (err) {
            if (err.message === 'Bus not found') {
                res.status(404).json({ error: err.message });
            } else {
                res.status(500).json({ error: err.message });
            }
            return;
        }
        res.json(result);
    });
});

// Restore deleted bus
app.post('/api/deleted/buses/:id/restore', (req, res) => {
    const { id } = req.params;
    db.get("SELECT * FROM deleted_buses WHERE id = ?", [id], (err, bus) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (!bus) {
            res.status(404).json({ error: 'Deleted bus not found' });
            return;
        }

        db.get("SELECT id FROM buses WHERE id = ?", [id], (err, existing) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            if (existing) {
                db.run("INSERT INTO buses (bus_number, assigned_driver_id, status, created_at) VALUES (?, ?, ?, ?)", 
                    [bus.bus_number, bus.assigned_driver_id, bus.status, bus.created_at], function(err) {
                    if (err) {
                        res.status(500).json({ error: err.message });
                        return;
                    }
                    db.run("DELETE FROM deleted_buses WHERE id = ?", [id], (err) => {
                        if (err) {
                            res.status(500).json({ error: err.message });
                            return;
                        }
                        res.json({ message: 'Bus restored successfully', newId: this.lastID });
                    });
                });
            } else {
                db.run("INSERT INTO buses (id, bus_number, assigned_driver_id, status, created_at) VALUES (?, ?, ?, ?, ?)", 
                    [bus.id, bus.bus_number, bus.assigned_driver_id, bus.status, bus.created_at], function(err) {
                    if (err) {
                        res.status(500).json({ error: err.message });
                        return;
                    }
                    db.run("DELETE FROM deleted_buses WHERE id = ?", [id], (err) => {
                        if (err) {
                            res.status(500).json({ error: err.message });
                            return;
                        }
                        res.json({ message: 'Bus restored successfully' });
                    });
                });
            }
        });
    });
});

// ===== TODAY DRIVER ASSIGNMENTS =====

app.get('/api/today-drivers', async (req, res) => {
    const today = new Date().toISOString().slice(0, 10);
    if (!mysqlPool) {
        return res.status(500).json({ error: 'MySQL is not initialized for today driver assignments.' });
    }
    try {
        const [rows] = await mysqlPool.execute(
            'SELECT id, bus_id, driver_id, assigned_date, assigned_at FROM today_driver_assignments WHERE assigned_date = ? ORDER BY assigned_at ASC',
            [today]
        );

        const busIds = [...new Set(rows.map(r => r.bus_id))];
        const driverIds = [...new Set(rows.map(r => r.driver_id))];

        let busMap = new Map();
        let driverMap = new Map();

        if (busIds.length > 0) {
            const placeholders = busIds.map(() => '?').join(',');
            const buses = await dbAll(`SELECT id, bus_number FROM buses WHERE id IN (${placeholders})`, busIds);
            buses.forEach(bus => busMap.set(bus.id, bus.bus_number));
        }

        if (driverIds.length > 0) {
            const placeholders = driverIds.map(() => '?').join(',');
            const drivers = await dbAll(`SELECT id, name FROM drivers WHERE id IN (${placeholders})`, driverIds);
            drivers.forEach(driver => driverMap.set(driver.id, driver.name));
        }

        const enrichedRows = rows.map(row => ({
            id: row.id,
            bus_id: row.bus_id,
            driver_id: row.driver_id,
            assigned_date: row.assigned_date,
            assigned_at: row.assigned_at,
            bus_number: busMap.get(row.bus_id) || 'Unknown Bus',
            driver_name: driverMap.get(row.driver_id) || 'Unknown Driver'
        }));

        res.json(enrichedRows);
    } catch (err) {
        console.error('Error fetching today driver assignments:', err.message);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/today-drivers', async (req, res) => {
    const { busId, driverId } = req.body;
    const today = new Date().toISOString().slice(0, 10);
    if (!mysqlPool) {
        return res.status(500).json({ success: false, message: 'MySQL connection is not available.' });
    }

    if (!busId || !driverId) {
        res.status(400).json({ success: false, message: 'Bus and Driver selection are required.' });
        return;
    }

    try {
        const bus = await dbGet('SELECT id, bus_number FROM buses WHERE id = ?', [busId]);
        const driver = await dbGet('SELECT id, name FROM drivers WHERE id = ?', [driverId]);

        if (!bus) {
            res.status(404).json({ success: false, message: 'Selected bus not found.' });
            return;
        }
        if (!driver) {
            res.status(404).json({ success: false, message: 'Selected driver not found.' });
            return;
        }

        const [existingBus] = await mysqlPool.execute(
            'SELECT id FROM today_driver_assignments WHERE assigned_date = ? AND bus_id = ?',
            [today, busId]
        );
        if (existingBus.length > 0) {
            res.status(400).json({ success: false, message: 'This bus is already assigned today.' });
            return;
        }

        const [existingDriver] = await mysqlPool.execute(
            'SELECT id FROM today_driver_assignments WHERE assigned_date = ? AND driver_id = ?',
            [today, driverId]
        );
        if (existingDriver.length > 0) {
            res.status(400).json({ success: false, message: 'This driver is already assigned today.' });
            return;
        }

        const [result] = await mysqlPool.execute(
            'INSERT INTO today_driver_assignments (bus_id, driver_id, assigned_date) VALUES (?, ?, ?)',
            [busId, driverId, today]
        );

        res.json({ success: true, id: result.insertId, bus_id: busId, driver_id: driverId, bus_number: bus.bus_number, driver_name: driver.name, assigned_date: today });
    } catch (err) {
        console.error('Error adding today driver assignment:', err.message);
        res.status(500).json({ success: false, message: 'Unable to save assignment.' });
    }
});

app.delete('/api/today-drivers/:id', async (req, res) => {
    const { id } = req.params;
    if (!mysqlPool) {
        return res.status(500).json({ success: false, message: 'MySQL connection is not available.' });
    }
    try {
        const [result] = await mysqlPool.execute('DELETE FROM today_driver_assignments WHERE id = ?', [id]);
        if (result.affectedRows === 0) {
            res.status(404).json({ success: false, message: 'Assignment not found.' });
            return;
        }
        res.json({ success: true, message: 'Assignment removed successfully.' });
    } catch (err) {
        console.error('Error deleting today driver assignment:', err.message);
        res.status(500).json({ success: false, message: 'Unable to remove assignment.' });
    }
});

// ===== BILLS =====

// Get all bills
app.get('/api/bills', (req, res) => {
    db.all("SELECT * FROM bills ORDER BY created_at DESC", (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Get deleted bills
app.get('/api/deleted/bills', (req, res) => {
    db.all("SELECT * FROM deleted_bills ORDER BY deleted_at DESC", (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Get deleted bill items
app.get('/api/deleted/bills/:id/items', (req, res) => {
    const { id } = req.params;
    db.all("SELECT * FROM deleted_bill_items WHERE bill_id = ?", [id], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Get bill with items
app.get('/api/bills/:id', (req, res) => {
    const { id } = req.params;
    db.get("SELECT * FROM bills WHERE id = ?", [id], (err, bill) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (!bill) {
            res.status(404).json({ error: 'Bill not found' });
            return;
        }
        db.all("SELECT * FROM bill_items WHERE bill_id = ?", [id], (err, items) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            bill.items = items;
            res.json(bill);
        });
    });
});

// Get bill items only
app.get('/api/bills/:id/items', (req, res) => {
    const { id } = req.params;
    db.all("SELECT * FROM bill_items WHERE bill_id = ?", [id], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Create new bill with items
app.post('/api/bills', (req, res) => {
    const { billNo, date, driver, busNo, moklnar, moklnarMobile, lenar, lenarMobile, total, jama, baki, items } = req.body;
    
    if (!billNo || !date || !driver || !busNo || !moklnar) {
        res.status(400).json({ error: 'Missing required fields' });
        return;
    }

    db.run(`
        INSERT INTO bills (bill_no, date, driver_name, bus_no, moklnar_name, moklnar_mobile, lenar_name, lenar_mobile, total, jama, baki)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [billNo, date, driver, busNo, moklnar, moklnarMobile || '', lenar || 'N/A', lenarMobile || '', total || 0, jama || 0, baki || 0], function(err) {
        if (err) {
            if (err.message.includes('UNIQUE')) {
                res.status(400).json({ error: 'Bill number already exists' });
            } else {
                res.status(500).json({ error: err.message });
            }
            return;
        }
        const billId = this.lastID;

        // Insert items
        if (items && items.length > 0) {
            const itemStmt = db.prepare(`
                INSERT INTO bill_items (bill_id, from_city, to_city, description, qty, remark, amount)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `);
            items.forEach(item => {
                itemStmt.run(billId, item.from || 'Rajkot', item.to || 'Surat', item.desc || '', item.qty || 1, item.remark || '', item.amount || 0);
            });
            itemStmt.finalize();
        }

        res.json({ id: billId, message: 'Bill created successfully' });
    });
});

// Update bill with items
app.put('/api/bills/:id', (req, res) => {
    const { id } = req.params;
    const { date, driver, busNo, moklnar, moklnarMobile, lenar, lenarMobile, total, jama, baki, items } = req.body;

    db.run(`
        UPDATE bills SET 
            date = ?, 
            driver_name = ?, 
            bus_no = ?, 
            moklnar_name = ?, 
            moklnar_mobile = ?, 
            lenar_name = ?, 
            lenar_mobile = ?, 
            total = ?, 
            jama = ?, 
            baki = ?
        WHERE id = ?
    `, [date, driver, busNo, moklnar, moklnarMobile || '', lenar || 'N/A', lenarMobile || '', total || 0, jama || 0, baki || 0, id], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (this.changes === 0) {
            res.status(404).json({ error: 'Bill not found' });
            return;
        }

        // Delete old items and insert new ones
        db.run("DELETE FROM bill_items WHERE bill_id = ?", [id], (err) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            if (items && items.length > 0) {
                const itemStmt = db.prepare(`
                    INSERT INTO bill_items (bill_id, from_city, to_city, description, qty, remark, amount)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `);
                items.forEach(item => {
                    itemStmt.run(id, item.from || 'Rajkot', item.to || 'Surat', item.desc || '', item.qty || 1, item.remark || '', item.amount || 0);
                });
                itemStmt.finalize();
            }
            res.json({ message: 'Bill updated successfully' });
        });
    });
});

// Delete bill (Soft Delete)
app.delete('/api/bills/:id', (req, res) => {
    const { id } = req.params;
    softDeleteBill(id, (err, result) => {
        if (err) {
            if (err.message === 'Bill not found') {
                res.status(404).json({ error: err.message });
            } else {
                res.status(500).json({ error: err.message });
            }
            return;
        }
        res.json(result);
    });
});

// Restore deleted bill
app.post('/api/deleted/bills/:id/restore', (req, res) => {
    const { id } = req.params;
    db.get("SELECT * FROM deleted_bills WHERE id = ?", [id], (err, bill) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (!bill) {
            res.status(404).json({ error: 'Deleted bill not found' });
            return;
        }

        // Get deleted items
        db.all("SELECT * FROM deleted_bill_items WHERE bill_id = ?", [id], (err, items) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }

            db.get("SELECT id FROM bills WHERE id = ?", [id], (err, existing) => {
                if (err) {
                    res.status(500).json({ error: err.message });
                    return;
                }
                
                const restoreBill = (newId) => {
                    // Insert items
                    if (items && items.length > 0) {
                        const itemStmt = db.prepare(`
                            INSERT INTO bill_items (id, bill_id, from_city, to_city, description, qty, remark, amount, created_at)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                        `);
                        items.forEach(item => {
                            itemStmt.run(item.id, newId, item.from_city, item.to_city, item.description, item.qty, item.remark, item.amount, item.created_at);
                        });
                        itemStmt.finalize();
                    }

                    db.run("DELETE FROM deleted_bills WHERE id = ?", [id], (err) => {
                        if (err) {
                            res.status(500).json({ error: err.message });
                            return;
                        }
                        db.run("DELETE FROM deleted_bill_items WHERE bill_id = ?", [id], (err) => {
                            if (err) {
                                res.status(500).json({ error: err.message });
                                return;
                            }
                            res.json({ message: 'Bill restored successfully', newId: newId });
                        });
                    });
                };

                if (existing) {
                    db.run(`INSERT INTO bills (bill_no, date, driver_name, bus_no, moklnar_name, moklnar_mobile, lenar_name, lenar_mobile, total, jama, baki, created_at)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [bill.bill_no, bill.date, bill.driver_name, bill.bus_no, bill.moklnar_name, bill.moklnar_mobile, bill.lenar_name, bill.lenar_mobile, bill.total, bill.jama, bill.baki, bill.created_at],
                        function(err) {
                            if (err) {
                                res.status(500).json({ error: err.message });
                                return;
                            }
                            restoreBill(this.lastID);
                        }
                    );
                } else {
                    db.run(`INSERT INTO bills (id, bill_no, date, driver_name, bus_no, moklnar_name, moklnar_mobile, lenar_name, lenar_mobile, total, jama, baki, created_at)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [bill.id, bill.bill_no, bill.date, bill.driver_name, bill.bus_no, bill.moklnar_name, bill.moklnar_mobile, bill.lenar_name, bill.lenar_mobile, bill.total, bill.jama, bill.baki, bill.created_at],
                        function(err) {
                            if (err) {
                                res.status(500).json({ error: err.message });
                                return;
                            }
                            restoreBill(bill.id);
                        }
                    );
                }
            });
        });
    });
});

// ===== REPORTS =====

// Get bills by date
app.get('/api/bills/date/:date', (req, res) => {
    const { date } = req.params;
    db.all(`
        SELECT b.*, bi.from_city, bi.to_city, bi.qty
        FROM bills b
        LEFT JOIN bill_items bi ON b.id = bi.bill_id
        WHERE b.date = ?
        ORDER BY b.created_at DESC
    `, [date], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        // Group items by bill
        const billsMap = new Map();
        rows.forEach(row => {
            if (!billsMap.has(row.id)) {
                billsMap.set(row.id, {
                    id: row.id,
                    bill_no: row.bill_no,
                    date: row.date,
                    driver_name: row.driver_name,
                    bus_no: row.bus_no,
                    moklnar_name: row.moklnar_name,
                    lenar_name: row.lenar_name,
                    total: row.total,
                    jama: row.jama,
                    baki: row.baki,
                    items: []
                });
            }
            if (row.from_city) {
                billsMap.get(row.id).items.push({
                    from_city: row.from_city,
                    to_city: row.to_city,
                    qty: row.qty
                });
            }
        });
        res.json(Array.from(billsMap.values()));
    });
});

// Get bills by month
app.get('/api/bills/month/:month', (req, res) => {
    const { month } = req.params;
    db.all(`
        SELECT b.*, bi.from_city, bi.to_city, bi.qty
        FROM bills b
        LEFT JOIN bill_items bi ON b.id = bi.bill_id
        WHERE strftime('%Y-%m', b.date) = ?
        ORDER BY b.created_at DESC
    `, [month], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        const billsMap = new Map();
        rows.forEach(row => {
            if (!billsMap.has(row.id)) {
                billsMap.set(row.id, {
                    id: row.id,
                    bill_no: row.bill_no,
                    date: row.date,
                    driver_name: row.driver_name,
                    bus_no: row.bus_no,
                    moklnar_name: row.moklnar_name,
                    lenar_name: row.lenar_name,
                    total: row.total,
                    jama: row.jama,
                    baki: row.baki,
                    items: []
                });
            }
            if (row.from_city) {
                billsMap.get(row.id).items.push({
                    from_city: row.from_city,
                    to_city: row.to_city,
                    qty: row.qty
                });
            }
        });
        res.json(Array.from(billsMap.values()));
    });
});

// ===== STATISTICS =====

app.get('/api/stats', (req, res) => {
    const today = new Date().toISOString().slice(0, 10);
    const currentMonth = today.slice(0, 7);

    const stats = {
        totalDrivers: 0,
        todayBills: 0,
        monthRevenue: 0,
        activeBuses: 0,
        deletedDrivers: 0,
        deletedBuses: 0,
        deletedBills: 0
    };

    db.get("SELECT COUNT(*) as count FROM drivers", (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        stats.totalDrivers = row.count;

        db.get("SELECT COUNT(*) as count FROM bills WHERE date = ?", [today], (err, row) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            stats.todayBills = row.count;

            db.get("SELECT SUM(total) as total FROM bills WHERE strftime('%Y-%m', date) = ?", [currentMonth], (err, row) => {
                if (err) {
                    res.status(500).json({ error: err.message });
                    return;
                }
                stats.monthRevenue = row.total || 0;

                db.get("SELECT COUNT(*) as count FROM buses WHERE status = 'Active'", (err, row) => {
                    if (err) {
                        res.status(500).json({ error: err.message });
                        return;
                    }
                    stats.activeBuses = row.count;

                    db.get("SELECT COUNT(*) as count FROM deleted_drivers", (err, row) => {
                        if (err) {
                            res.status(500).json({ error: err.message });
                            return;
                        }
                        stats.deletedDrivers = row.count;

                        db.get("SELECT COUNT(*) as count FROM deleted_buses", (err, row) => {
                            if (err) {
                                res.status(500).json({ error: err.message });
                                return;
                            }
                            stats.deletedBuses = row.count;

                            db.get("SELECT COUNT(*) as count FROM deleted_bills", (err, row) => {
                                if (err) {
                                    res.status(500).json({ error: err.message });
                                    return;
                                }
                                stats.deletedBills = row.count;
                                res.json(stats);
                            });
                        });
                    });
                });
            });
        });
    });
});

// ===== SERVE STATIC FILES =====

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});