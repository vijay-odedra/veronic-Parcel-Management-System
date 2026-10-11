require('dotenv').config();
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const mysql = require('mysql2/promise');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const firebaseService = require('./firebase-service');

const app = express();
const PORT = Number(process.env.PORT) || 3001;

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
app.use(express.static(path.join(__dirname, 'public')));
app.use('/images', express.static(path.join(__dirname, 'images')));
app.use('/public/images', express.static(path.join(__dirname, 'public', 'images')));

let isServerRunning = false;
function startServer() {
    if (isServerRunning) return;
    try {
        app.listen(PORT, () => {
            isServerRunning = true;
            console.log(`Server running on http://localhost:${PORT}`);
        });
    } catch (e) {
        console.error('Server listen error:', e.message);
    }
}

// Start HTTP server immediately for instant UI response
startServer();

// Database connection & asynchronous background initialization
const dbPath = path.join(__dirname, 'veronic_fleet.db');
let db = null;
try {
    db = new sqlite3.Database(dbPath, async (err) => {
        if (err) {
            console.error('Error connecting to SQLite database:', err.message);
        } else {
            console.log('Connected to SQLite database at', dbPath);
            try {
                initializeDatabase();
                createAuthTables();
                createAdminTables();
                initializeMySQL().catch(e => console.warn('MySQL init:', e.message));
                firebaseService.initFirebase(db);
            } catch (initErr) {
                console.warn('DB initialization notice:', initErr.message);
            }
        }
    });
} catch (e) {
    console.error('SQLite initialization exception:', e.message);
}

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
            license_no TEXT,
            status TEXT DEFAULT 'Active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `, () => {
        db.run("ALTER TABLE drivers ADD COLUMN license_no TEXT", () => {});
        db.run("ALTER TABLE drivers ADD COLUMN status TEXT DEFAULT 'Active'", () => {});
        db.run("UPDATE drivers SET license_no = 'GJ-03-2022-' || (1000 + id*37) WHERE license_no IS NULL", () => {});
        db.run("UPDATE drivers SET status = 'Active' WHERE status IS NULL", () => {});
    });

    // Create deleted_drivers table
    db.run(`
        CREATE TABLE IF NOT EXISTS deleted_drivers (
            id INTEGER,
            name TEXT NOT NULL,
            mobile TEXT,
            license_no TEXT,
            status TEXT,
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
            bus_type TEXT DEFAULT 'AC Sleeper (2+1)',
            route TEXT DEFAULT 'Rajkot – Surat',
            status TEXT DEFAULT 'Active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (assigned_driver_id) REFERENCES drivers(id) ON DELETE SET NULL
        )
    `, () => {
        db.run("ALTER TABLE buses ADD COLUMN bus_type TEXT DEFAULT 'AC Sleeper (2+1)'", () => {});
        db.run("ALTER TABLE buses ADD COLUMN route TEXT DEFAULT 'Rajkot – Surat'", () => {});
        db.run("UPDATE buses SET bus_type = 'AC Sleeper (2+1)' WHERE bus_type IS NULL", () => {});
        db.run("UPDATE buses SET route = 'Rajkot – Surat' WHERE route IS NULL", () => {});
        db.run("UPDATE buses SET status = 'Active' WHERE status IS NULL", () => {});
    });

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

    // Ensure office_id is present across all fleet tables
    db.run("ALTER TABLE drivers ADD COLUMN office_id INTEGER DEFAULT 1", () => {});
    db.run("ALTER TABLE buses ADD COLUMN office_id INTEGER DEFAULT 1", () => {});
    db.run("ALTER TABLE today_driver_assignments ADD COLUMN office_id INTEGER DEFAULT 1", () => {});
    db.run("ALTER TABLE deleted_drivers ADD COLUMN office_id INTEGER DEFAULT 1", () => {});
    db.run("ALTER TABLE deleted_buses ADD COLUMN office_id INTEGER DEFAULT 1", () => {});
    db.run("ALTER TABLE deleted_bills ADD COLUMN office_id INTEGER DEFAULT 1", () => {});

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
        ['0001', '2026-06-17', 'Ramesh Makwana', 'GJ-01-LTZ1162', 'vijay odedra', '9510075279', 'vansh', '9909876756', 50000, 50000, 20000],
        ['0002', '2026-06-18', 'chirag', 'GJ-01-LTZ1163', 'shujal', '9825840119', 'ram', '9825840819', 5000, 5000, 1000],
        ['0003', '2026-06-18', 'vashu odedra', 'GJ-01-LTZ1166', 'raju', '7878929391', 'ram', '8909878667', 50000, 50000, 10000],
        ['0004', '2026-06-18', 'vivek', 'GJ-01-LTZ1163', 'ramesh', '215489637', 'rohan', '369852147', 20000, 20000, 50000],
        ['0005', '2026-06-18', 'Ramesh Makwana', 'GJ-01-LTZ1166', 'viren', '6789012345', 'radhika', '5678901234', 50000, 50000, 10000],
        ['0006', '2026-06-18', 'vivek', 'GJ-01-LTZ1166', 'shujal', '6789501234', 'chagan', '1222134564', 10000, 10000, 20000],
        ['0007', '2026-06-18', 'vashu', 'GJ-01-LTZ1166', 'harshil', '2365897410', 'shujal', '124587963', 25000, 25000, 5000],
        ['0008', '2026-06-18', 'vijay', 'GJ-01-LTZ1166', 'ridhi', '5421098765', 'roshni', '2345654378', 50000, 50000, 10000]
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
            db.run("ALTER TABLE users ADD COLUMN office_id INTEGER DEFAULT 1", () => {});
            db.run("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'member'", () => {});
            db.run("ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'Active'", () => {});
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
    const demoUsers = [
        ['Main Admin', 'mainadmin@veronic.com', 'admin123'],
        ['Admin', 'admin@veronic.com', 'admin123'],
        ['Rajkot Sub-Admin', 'rajkotadmin@veronic.com', 'admin123'],
        ['Demo User', 'demo@example.com', 'demo'],
        ['Simple User', 'user@simple.com', '123']
    ];
    
    demoUsers.forEach(([name, email, password]) => {
        db.run(
            "INSERT INTO users (name, email, password) SELECT ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = ?)",
            [name, email, password, email],
            (err) => {
                if (err) {
                    console.error(`Error ensuring demo user ${email}:`, err.message);
                }
            }
        );
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

// ===== LOGIN (UNIFIED FOR MAIN ADMIN, OFFICE ADMIN & USERS) =====
app.post('/api/login', async (req, res) => {
    try {
        const usernameOrEmail = (req.body.email || req.body.username || req.body.usernameOrEmail || '').trim();
        const password = req.body.password;
        
        if (!usernameOrEmail || !password) {
            return res.status(400).json({ 
                success: false, 
                message: 'Email / Username and password are required' 
            });
        }

        // 1. Check in Admins table first
        db.get(`
            SELECT a.*, o.office_name, o.office_code, o.city
            FROM admins a
            LEFT JOIN offices o ON a.office_id = o.id
            WHERE (LOWER(a.username) = LOWER(?) OR LOWER(a.email) = LOWER(?)) AND a.password = ?
        `, [usernameOrEmail, usernameOrEmail, password], async (err, admin) => {
            if (err) {
                return res.status(500).json({ success: false, message: 'Database error: ' + err.message });
            }

            if (admin) {
                if (admin.status !== 'Active') {
                    return res.status(403).json({ success: false, message: 'Your admin account is deactivated. Contact Super Admin.' });
                }

                const token = 'adm_' + Date.now() + '_' + Math.random().toString(36).substring(2, 15);
                
                db.run("INSERT INTO admin_sessions (admin_id, token) VALUES (?, ?)", [admin.id, token], () => {});
                
                const expiresAt = new Date();
                expiresAt.setDate(expiresAt.getDate() + 7);
                db.run("INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)", [admin.id, token, expiresAt.toISOString()], () => {});

                db.run("UPDATE admins SET last_login = CURRENT_TIMESTAMP WHERE id = ?", [admin.id]);
                logAdminActivity(admin.id, admin.office_id, 'LOGIN', `${admin.name} logged into system`, req);

                const permissions = await new Promise(resolve => {
                    db.all("SELECT permission_key FROM admin_permissions WHERE admin_id = ? AND is_granted = 1", [admin.id], (pErr, rows) => {
                        resolve((rows || []).map(r => r.permission_key));
                    });
                });

                const adminData = {
                    id: admin.id,
                    name: admin.name,
                    username: admin.username,
                    email: admin.email,
                    role: admin.role,
                    office_id: admin.office_id,
                    office_name: admin.office_name || (admin.role === 'main_admin' ? 'All Offices (Super Admin)' : 'Branch Office'),
                    office_code: admin.office_code || 'ALL',
                    city: admin.city || 'ALL',
                    permissions
                };

                let redirectTo = '/index.html';
                if (admin.role === 'main_admin') {
                    redirectTo = '/admin/index.html';
                } else if (admin.office_id) {
                    redirectTo = `/index.html?office_id=${admin.office_id}&office_code=${encodeURIComponent(admin.office_code || '')}`;
                }

                return res.json({
                    success: true,
                    message: 'Login successful',
                    data: {
                        user: adminData,
                        token,
                        role: admin.role,
                        office_id: admin.office_id,
                        redirectTo
                    }
                });
            }

            // 2. Check in Users table
            db.get(`
                SELECT u.*, o.office_name, o.office_code, o.city
                FROM users u
                LEFT JOIN offices o ON u.office_id = o.id
                WHERE (LOWER(u.email) = LOWER(?) OR LOWER(u.name) = LOWER(?)) AND u.password = ?
            `, [usernameOrEmail, usernameOrEmail, password], 
                async (uErr, user) => {
                    if (uErr) {
                        return res.status(500).json({ success: false, message: 'Database error: ' + uErr.message });
                    }

                    if (!user) {
                        return res.status(401).json({ 
                            success: false, 
                            message: 'Invalid credentials. Please check your username/email and password.' 
                        });
                    }

                    if (user.status === 'Inactive') {
                        return res.status(403).json({ success: false, message: 'Your account is deactivated. Contact Admin.' });
                    }

                    const token = generateToken();
                    await createSession(user.id, token);
                    const { password: _, ...userWithoutPassword } = user;

                    const officeId = user.office_id || 1;
                    const officeCode = user.office_code || 'OFF-001';
                    const redirectTo = `/index.html?office_id=${officeId}&office_code=${encodeURIComponent(officeCode)}`;

                    return res.json({
                        success: true,
                        message: 'Login successful',
                        data: { 
                            user: {
                                ...userWithoutPassword,
                                office_id: officeId,
                                office_name: user.office_name || 'Branch Office',
                                office_code: officeCode,
                                city: user.city || 'Branch'
                            }, 
                            token,
                            role: user.role || 'member',
                            office_id: officeId,
                            redirectTo
                        }
                    });
                }
            );
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
        await deleteSession(token);
        db.run("DELETE FROM admin_sessions WHERE token = ?", [token], () => {});
        res.json({ 
            success: true, 
            message: 'Logged out successfully' 
        });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error' 
        });
    }
});

// ===== VERIFY SESSION (UNIFIED) =====
app.get('/api/verify', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ 
                success: false, 
                message: 'No token provided' 
            });
        }

        // 1. Check admin sessions first
        const admin = await new Promise(resolve => {
            db.get(`
                SELECT a.id, a.name, a.username, a.email, a.role, a.office_id,
                       o.office_name, o.office_code, o.city
                FROM admin_sessions s
                JOIN admins a ON s.admin_id = a.id
                LEFT JOIN offices o ON a.office_id = o.id
                WHERE s.token = ? AND a.status = 'Active'
            `, [token], (err, row) => resolve(row));
        });

        if (admin) {
            return res.json({
                success: true,
                message: 'Session valid',
                data: {
                    user: admin,
                    role: admin.role,
                    office_id: admin.office_id
                }
            });
        }

        // 2. Check standard user sessions
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
                    email: session.email,
                    role: 'user'
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

// ===== PUBLIC/APP OFFICES ENDPOINTS =====
app.get('/api/offices', async (req, res) => {
    try {
        db.all("SELECT id, office_name, office_code, office_type, city, state, address, phone, email, manager, status FROM offices WHERE status = 'Active' ORDER BY id ASC", (err, rows) => {
            if (err) return res.status(500).json({ success: false, error: err.message });
            res.json({ success: true, data: rows || [] });
        });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.get('/api/offices/:id', async (req, res) => {
    try {
        const { id } = req.params;
        db.get("SELECT * FROM offices WHERE id = ?", [id], (err, row) => {
            if (err) return res.status(500).json({ success: false, error: err.message });
            if (!row) return res.status(404).json({ success: false, error: 'Office not found' });
            res.json({ success: true, data: row });
        });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
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
    const { office_id } = req.query;
    let query = "SELECT * FROM drivers";
    const params = [];
    if (office_id && office_id !== 'ALL') {
        query += " WHERE office_id = ?";
        params.push(office_id);
    }
    query += " ORDER BY name";
    db.all(query, params, (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Get deleted drivers
app.get('/api/deleted/drivers', (req, res) => {
    const { office_id } = req.query;
    let query = "SELECT * FROM deleted_drivers";
    const params = [];
    if (office_id && office_id !== 'ALL') {
        query += " WHERE office_id = ?";
        params.push(office_id);
    }
    query += " ORDER BY deleted_at DESC";
    db.all(query, params, (err, rows) => {
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
    const { name, mobile, license_no, status, office_id } = req.body;
    if (!name) {
        res.status(400).json({ error: 'Name is required' });
        return;
    }
    const lic = license_no || ('GJ-03-2023-' + Math.floor(1000 + Math.random() * 9000));
    const st = status || 'Active';
    const offId = office_id || 1;
    db.run("INSERT INTO drivers (name, mobile, license_no, status, office_id) VALUES (?, ?, ?, ?, ?)", [name, mobile || '', lic, st, offId], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ id: this.lastID, name, mobile, license_no: lic, status: st, office_id: offId });
    });
});

// Update driver
app.put('/api/drivers/:id', (req, res) => {
    const { id } = req.params;
    const { name, mobile, license_no, status, office_id } = req.body;
    if (!name) {
        res.status(400).json({ error: 'Name is required' });
        return;
    }
    db.run("UPDATE drivers SET name = ?, mobile = ?, license_no = ?, status = ?, office_id = COALESCE(?, office_id) WHERE id = ?", [name, mobile || '', license_no || '', status || 'Active', office_id || null, id], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (this.changes === 0) {
            res.status(404).json({ error: 'Driver not found' });
            return;
        }
        res.json({ id: parseInt(id), name, mobile, license_no, status: status || 'Active' });
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
                db.run("INSERT INTO drivers (name, mobile, license_no, status, office_id, created_at) VALUES (?, ?, ?, ?, ?, ?)", 
                    [driver.name, driver.mobile, driver.license_no || '', driver.status || 'Active', driver.office_id || 1, driver.created_at], function(err) {
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
                db.run("INSERT INTO drivers (id, name, mobile, license_no, status, office_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", 
                    [driver.id, driver.name, driver.mobile, driver.license_no || '', driver.status || 'Active', driver.office_id || 1, driver.created_at], function(err) {
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
    const { office_id } = req.query;
    let query = `
        SELECT b.*, d.name as driver_name 
        FROM buses b
        LEFT JOIN drivers d ON b.assigned_driver_id = d.id
    `;
    const params = [];
    if (office_id && office_id !== 'ALL') {
        query += ` WHERE b.office_id = ?`;
        params.push(office_id);
    }
    query += ` ORDER BY b.bus_number`;

    db.all(query, params, (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Get deleted buses
app.get('/api/deleted/buses', (req, res) => {
    const { office_id } = req.query;
    let query = "SELECT * FROM deleted_buses";
    const params = [];
    if (office_id && office_id !== 'ALL') {
        query += " WHERE office_id = ?";
        params.push(office_id);
    }
    query += " ORDER BY deleted_at DESC";
    db.all(query, params, (err, rows) => {
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
    const { busNumber, assignedDriverId, bus_type, route, status, office_id } = req.body;
    if (!busNumber) {
        res.status(400).json({ error: 'Bus number is required' });
        return;
    }
    const bType = bus_type || 'AC Sleeper (2+1)';
    const bRoute = route || 'Rajkot – Surat';
    const bStatus = status || 'Active';
    const offId = office_id || 1;
    db.run("INSERT INTO buses (bus_number, assigned_driver_id, bus_type, route, status, office_id) VALUES (?, ?, ?, ?, ?, ?)", 
        [busNumber, assignedDriverId || null, bType, bRoute, bStatus, offId], function(err) {
        if (err) {
            if (err.message.includes('UNIQUE')) {
                res.status(400).json({ error: 'Bus number already exists' });
            } else {
                res.status(500).json({ error: err.message });
            }
            return;
        }
        res.json({ id: this.lastID, busNumber, assignedDriverId, bus_type: bType, route: bRoute, status: bStatus, office_id: offId });
    });
});

// Update bus
app.put('/api/buses/:id', (req, res) => {
    const { id } = req.params;
    const { busNumber, assignedDriverId, bus_type, route, status, office_id } = req.body;
    if (!busNumber) {
        res.status(400).json({ error: 'Bus number is required' });
        return;
    }
    db.run("UPDATE buses SET bus_number = ?, assigned_driver_id = ?, bus_type = ?, route = ?, status = ?, office_id = COALESCE(?, office_id) WHERE id = ?", 
        [busNumber, assignedDriverId || null, bus_type || 'AC Sleeper (2+1)', route || 'Rajkot – Surat', status || 'Active', office_id || null, id], function(err) {
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
        res.json({ id: parseInt(id), busNumber, assignedDriverId, bus_type, route, status });
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
    const { office_id } = req.query;

    if (mysqlPool) {
        try {
            let sql = 'SELECT id, bus_id, driver_id, assigned_date, assigned_at, office_id FROM today_driver_assignments WHERE assigned_date = ?';
            let params = [today];
            if (office_id && office_id !== 'ALL') {
                sql += ' AND office_id = ?';
                params.push(office_id);
            }
            sql += ' ORDER BY assigned_at ASC';
            const [rows] = await mysqlPool.execute(sql, params);

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
                office_id: row.office_id,
                assigned_date: row.assigned_date,
                assigned_at: row.assigned_at,
                bus_number: busMap.get(row.bus_id) || 'Unknown Bus',
                driver_name: driverMap.get(row.driver_id) || 'Unknown Driver'
            }));

            return res.json(enrichedRows);
        } catch (err) {
            console.error('Error fetching today driver assignments MySQL:', err.message);
        }
    }

    // SQLite Fallback
    let sQuery = 'SELECT * FROM today_driver_assignments WHERE assigned_date = ?';
    let sParams = [today];
    if (office_id && office_id !== 'ALL') {
        sQuery += ' AND office_id = ?';
        sParams.push(office_id);
    }
    sQuery += ' ORDER BY assigned_at ASC';

    db.all(sQuery, sParams, async (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        const list = rows || [];
        const busIds = [...new Set(list.map(r => r.bus_id))];
        const driverIds = [...new Set(list.map(r => r.driver_id))];

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

        const enrichedRows = list.map(row => ({
            id: row.id,
            bus_id: row.bus_id,
            driver_id: row.driver_id,
            office_id: row.office_id,
            assigned_date: row.assigned_date,
            assigned_at: row.assigned_at,
            bus_number: busMap.get(row.bus_id) || 'Unknown Bus',
            driver_name: driverMap.get(row.driver_id) || 'Unknown Driver'
        }));

        res.json(enrichedRows);
    });
});

app.post('/api/today-drivers', async (req, res) => {
    const { busId, driverId, office_id } = req.body;
    const offId = office_id || 1;
    const today = new Date().toISOString().slice(0, 10);

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

        if (mysqlPool) {
            try {
                const [existingBus] = await mysqlPool.execute(
                    'SELECT id FROM today_driver_assignments WHERE assigned_date = ? AND bus_id = ?',
                    [today, busId]
                );
                if (existingBus.length > 0) {
                    return res.status(400).json({ success: false, message: 'This bus is already assigned today.' });
                }

                const [existingDriver] = await mysqlPool.execute(
                    'SELECT id FROM today_driver_assignments WHERE assigned_date = ? AND driver_id = ?',
                    [today, driverId]
                );
                if (existingDriver.length > 0) {
                    return res.status(400).json({ success: false, message: 'This driver is already assigned today.' });
                }

                const [result] = await mysqlPool.execute(
                    'INSERT INTO today_driver_assignments (bus_id, driver_id, assigned_date, office_id) VALUES (?, ?, ?, ?)',
                    [busId, driverId, today, offId]
                );

                return res.json({ success: true, id: result.insertId, bus_id: busId, driver_id: driverId, office_id: offId, bus_number: bus.bus_number, driver_name: driver.name, assigned_date: today });
            } catch (mErr) {
                console.error('MySQL insert error:', mErr.message);
            }
        }

        // SQLite fallback
        db.run(
            'INSERT INTO today_driver_assignments (bus_id, driver_id, assigned_date, office_id) VALUES (?, ?, ?, ?)',
            [busId, driverId, today, offId],
            function (sErr) {
                if (sErr) {
                    return res.status(400).json({ success: false, message: sErr.message });
                }
                res.json({ success: true, id: this.lastID, bus_id: busId, driver_id: driverId, office_id: offId, bus_number: bus.bus_number, driver_name: driver.name, assigned_date: today });
            }
        );
    } catch (err) {
        console.error('Error adding today driver assignment:', err.message);
        res.status(500).json({ success: false, message: 'Unable to save assignment.' });
    }
});

app.delete('/api/today-drivers/:id', async (req, res) => {
    const { id } = req.params;
    if (mysqlPool) {
        try {
            await mysqlPool.execute('DELETE FROM today_driver_assignments WHERE id = ?', [id]);
        } catch (e) {}
    }
    db.run('DELETE FROM today_driver_assignments WHERE id = ?', [id], function (err) {
        if (err) {
            return res.status(500).json({ success: false, message: 'Unable to remove assignment.' });
        }
        res.json({ success: true, message: 'Assignment removed successfully.' });
    });
});

// ===== BILLS =====

// Get all bills
app.get('/api/bills', (req, res) => {
    const { office_id } = req.query;
    let query = "SELECT * FROM bills";
    const params = [];
    if (office_id && office_id !== 'ALL') {
        query += " WHERE office_id = ?";
        params.push(office_id);
    }
    query += " ORDER BY created_at DESC";
    db.all(query, params, (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Get deleted bills
app.get('/api/deleted/bills', (req, res) => {
    const { office_id } = req.query;
    let query = "SELECT * FROM deleted_bills";
    const params = [];
    if (office_id && office_id !== 'ALL') {
        query += " WHERE office_id = ?";
        params.push(office_id);
    }
    query += " ORDER BY deleted_at DESC";
    db.all(query, params, (err, rows) => {
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

// ===== BILL REPORTS (Defined before /api/bills/:id) =====

// Get bills by range (startDate, endDate)
app.get('/api/bills/range', (req, res) => {
    const { startDate, endDate, office_id } = req.query;
    let query = `
        SELECT b.*, bi.from_city, bi.to_city, bi.qty
        FROM bills b
        LEFT JOIN bill_items bi ON b.id = bi.bill_id
        WHERE 1=1
    `;
    const params = [];
    if (startDate && endDate) {
        query += ` AND b.date >= ? AND b.date <= ?`;
        params.push(startDate, endDate);
    } else if (startDate) {
        query += ` AND b.date >= ?`;
        params.push(startDate);
    } else if (endDate) {
        query += ` AND b.date <= ?`;
        params.push(endDate);
    }
    if (office_id && office_id !== 'ALL') {
        query += ` AND b.office_id = ?`;
        params.push(office_id);
    }
    query += ` ORDER BY b.date DESC, b.created_at DESC`;

    db.all(query, params, (err, rows) => {
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
                    office_id: row.office_id,
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

// Get bills by date
app.get('/api/bills/date/:date', (req, res) => {
    const { date } = req.params;
    const { office_id } = req.query;
    let query = `
        SELECT b.*, bi.from_city, bi.to_city, bi.qty
        FROM bills b
        LEFT JOIN bill_items bi ON b.id = bi.bill_id
        WHERE b.date = ?
    `;
    const params = [date];
    if (office_id && office_id !== 'ALL') {
        query += ` AND b.office_id = ?`;
        params.push(office_id);
    }
    query += ` ORDER BY b.created_at DESC`;

    db.all(query, params, (err, rows) => {
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
                    office_id: row.office_id,
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
    const { office_id } = req.query;
    let query = `
        SELECT b.*, bi.from_city, bi.to_city, bi.qty
        FROM bills b
        LEFT JOIN bill_items bi ON b.id = bi.bill_id
        WHERE strftime('%Y-%m', b.date) = ?
    `;
    const params = [month];
    if (office_id && office_id !== 'ALL') {
        query += ` AND b.office_id = ?`;
        params.push(office_id);
    }
    query += ` ORDER BY b.created_at DESC`;

    db.all(query, params, (err, rows) => {
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
                    office_id: row.office_id,
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

// Get bills by year
app.get('/api/bills/year/:year', (req, res) => {
    const { year } = req.params;
    const { office_id } = req.query;
    let query = `
        SELECT b.*, bi.from_city, bi.to_city, bi.qty
        FROM bills b
        LEFT JOIN bill_items bi ON b.id = bi.bill_id
        WHERE strftime('%Y', b.date) = ?
    `;
    const params = [year];
    if (office_id && office_id !== 'ALL') {
        query += ` AND b.office_id = ?`;
        params.push(office_id);
    }
    query += ` ORDER BY b.date DESC, b.created_at DESC`;

    db.all(query, params, (err, rows) => {
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
    const { billNo, date, driver, busNo, moklnar, moklnarMobile, lenar, lenarMobile, total, jama, baki, items, office_id } = req.body;
    
    if (!billNo || !date || !driver || !busNo || !moklnar) {
        res.status(400).json({ error: 'Missing required fields' });
        return;
    }

    db.run(`
        INSERT INTO bills (bill_no, date, driver_name, bus_no, moklnar_name, moklnar_mobile, lenar_name, lenar_mobile, total, jama, baki, office_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [billNo, date, driver, busNo, moklnar, moklnarMobile || '', lenar || 'N/A', lenarMobile || '', total || 0, jama || 0, baki || 0, office_id || 1], function(err) {
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
// ===== STATISTICS =====

app.get('/api/stats', (req, res) => {
    const today = new Date().toISOString().slice(0, 10);
    const currentMonth = today.slice(0, 7);
    const officeId = req.query.office_id;

    const stats = {
        totalDrivers: 0,
        todayBills: 0,
        monthRevenue: 0,
        activeBuses: 0,
        deletedDrivers: 0,
        deletedBuses: 0,
        deletedBills: 0
    };

    let driverQuery = "SELECT COUNT(*) as count FROM drivers WHERE 1=1";
    let driverParams = [];
    if (officeId && officeId !== 'ALL') {
        driverQuery += " AND office_id = ?";
        driverParams.push(officeId);
    }

    db.get(driverQuery, driverParams, (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        stats.totalDrivers = row ? row.count : 0;

        let todayBillsQuery = "SELECT COUNT(*) as count FROM bills WHERE date = ?";
        let todayBillsParams = [today];
        if (officeId && officeId !== 'ALL') {
            todayBillsQuery += " AND office_id = ?";
            todayBillsParams.push(officeId);
        }

        db.get(todayBillsQuery, todayBillsParams, (err, bRow) => {
            if (err) return res.status(500).json({ error: err.message });
            stats.todayBills = bRow ? bRow.count : 0;

            let monthRevenueQuery = "SELECT SUM(total) as total FROM bills WHERE strftime('%Y-%m', date) = ?";
            let monthRevenueParams = [currentMonth];
            if (officeId && officeId !== 'ALL') {
                monthRevenueQuery += " AND office_id = ?";
                monthRevenueParams.push(officeId);
            }

            db.get(monthRevenueQuery, monthRevenueParams, (err, mRow) => {
                if (err) return res.status(500).json({ error: err.message });
                stats.monthRevenue = (mRow && mRow.total) ? mRow.total : 0;

                let busQuery = "SELECT COUNT(*) as count FROM buses WHERE status = 'Active'";
                let busParams = [];
                if (officeId && officeId !== 'ALL') {
                    busQuery += " AND office_id = ?";
                    busParams.push(officeId);
                }

                db.get(busQuery, busParams, (err, busRow) => {
                    if (err) return res.status(500).json({ error: err.message });
                    stats.activeBuses = busRow ? busRow.count : 0;

                    let delDriverQuery = "SELECT COUNT(*) as count FROM deleted_drivers WHERE 1=1";
                    let delDriverParams = [];
                    if (officeId && officeId !== 'ALL') {
                        delDriverQuery += " AND office_id = ?";
                        delDriverParams.push(officeId);
                    }
                    db.get(delDriverQuery, delDriverParams, (err, dRow) => {
                        stats.deletedDrivers = dRow ? dRow.count : 0;

                        let delBusQuery = "SELECT COUNT(*) as count FROM deleted_buses WHERE 1=1";
                        let delBusParams = [];
                        if (officeId && officeId !== 'ALL') {
                            delBusQuery += " AND office_id = ?";
                            delBusParams.push(officeId);
                        }
                        db.get(delBusQuery, delBusParams, (err, dbRow) => {
                            stats.deletedBuses = dbRow ? dbRow.count : 0;

                            let delBillQuery = "SELECT COUNT(*) as count FROM deleted_bills WHERE 1=1";
                            let delBillParams = [];
                            if (officeId && officeId !== 'ALL') {
                                delBillQuery += " AND office_id = ?";
                                delBillParams.push(officeId);
                            }
                            db.get(delBillQuery, delBillParams, (err, biRow) => {
                                stats.deletedBills = biRow ? biRow.count : 0;
                                res.json(stats);
                            });
                        });
                    });
                });
            });
        });
    });
});

// ============================================================
// MAIN ADMIN & MULTI-OFFICE SYSTEM (SEPARATE & ISOLATED)
// ============================================================

function createAdminTables() {
    // 1. Offices Table
    db.run(`
        CREATE TABLE IF NOT EXISTS offices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            office_name TEXT NOT NULL,
            office_code TEXT UNIQUE NOT NULL,
            office_type TEXT DEFAULT 'Branch',
            city TEXT NOT NULL,
            state TEXT DEFAULT 'Gujarat',
            pincode TEXT,
            address TEXT,
            phone TEXT,
            email TEXT,
            manager TEXT,
            opening_time TEXT DEFAULT '08:00 AM',
            closing_time TEXT DEFAULT '09:00 PM',
            status TEXT DEFAULT 'Active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `, (err) => {
        if (err) console.error('Error creating offices table:', err.message);
        else {
            // Run column migrations for older DB instances
            db.run("ALTER TABLE offices ADD COLUMN office_type TEXT DEFAULT 'Branch'", () => {});
            db.run("ALTER TABLE offices ADD COLUMN state TEXT DEFAULT 'Gujarat'", () => {});
            db.run("ALTER TABLE offices ADD COLUMN pincode TEXT", () => {});
            db.run("ALTER TABLE offices ADD COLUMN opening_time TEXT DEFAULT '08:00 AM'", () => {});
            db.run("ALTER TABLE offices ADD COLUMN closing_time TEXT DEFAULT '09:00 PM'", () => {});
            db.run("ALTER TABLE bills ADD COLUMN office_id INTEGER DEFAULT 1", () => {});

            console.log('✅ Admin Offices table ready');
            // 2. Admins Table
            db.run(`
                CREATE TABLE IF NOT EXISTS admins (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    username TEXT UNIQUE NOT NULL,
                    email TEXT UNIQUE NOT NULL,
                    password TEXT NOT NULL,
                    phone TEXT,
                    office_id INTEGER,
                    role TEXT DEFAULT 'sub_admin',
                    status TEXT DEFAULT 'Active',
                    last_login DATETIME,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (office_id) REFERENCES offices(id) ON DELETE SET NULL
                )
            `, (err) => {
                if (err) console.error('Error creating admins table:', err.message);
                else {
                    console.log('✅ Admins table ready');
                    // 3. Admin Permissions Table
                    db.run(`
                        CREATE TABLE IF NOT EXISTS admin_permissions (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            admin_id INTEGER NOT NULL,
                            permission_key TEXT NOT NULL,
                            is_granted INTEGER DEFAULT 1,
                            FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE,
                            UNIQUE(admin_id, permission_key)
                        )
                    `);
                    // 4. Admin Sessions Table
                    db.run(`
                        CREATE TABLE IF NOT EXISTS admin_sessions (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            admin_id INTEGER NOT NULL,
                            token TEXT UNIQUE NOT NULL,
                            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                            expires_at DATETIME,
                            FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
                        )
                    `);
                    // 5. Admin Activity Logs Table
                    db.run(`
                        CREATE TABLE IF NOT EXISTS admin_activity_logs (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            admin_id INTEGER,
                            office_id INTEGER,
                            action TEXT NOT NULL,
                            details TEXT,
                            ip_address TEXT,
                            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                        )
                    `);
                    insertDefaultAdminData();
                }
            });
        }
    });
}

function insertDefaultAdminData() {
    db.get("SELECT COUNT(*) as count FROM offices", (err, row) => {
        if (!err && row && row.count === 0) {
            const defaultOffices = [
                ['Rajkot Central Office', 'OFF-001', 'Rajkot', 'Vavdi Main Road, Opp. PGVCL Office, Rajkot - 360004', '+91 83201 48345', 'rajkot@veronic.com', 'Bhanji Bhai', 'Active'],
                ['Ahmedabad Hub', 'OFF-002', 'Ahmedabad', 'Geeta Mandir Bus Stand Road, Ahmedabad - 380022', '+91 98258 40119', 'ahmedabad@veronic.com', 'Suresh Patel', 'Active'],
                ['Surat Central Office', 'OFF-003', 'Surat', 'Rupa Apt, Opp. Umiya Dham, Varachha Road, Surat - 395006', '+91 89801 91525', 'surat@veronic.com', 'Pravin Bhai', 'Active'],
                ['Jamnagar Branch', 'OFF-004', 'Jamnagar', 'Indira Gandhi Marg, Near Gurudwara, Jamnagar - 361001', '+91 94282 11020', 'jamnagar@veronic.com', 'Kishore Sinh', 'Active'],
                ['Morbi Office', 'OFF-005', 'Morbi', 'Sanala Road, Near New Bus Stand, Morbi - 363641', '+91 97245 88990', 'morbi@veronic.com', 'Dilip Bhai', 'Active']
            ];
            const stmt = db.prepare("INSERT INTO offices (office_name, office_code, city, address, phone, email, manager, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
            defaultOffices.forEach(o => stmt.run(...o));
            stmt.finalize(() => {
                console.log('✅ Seeded 5 initial offices');
                seedAdmins();
            });
        } else {
            seedAdmins();
        }
    });
}

function seedAdmins() {
    db.get("SELECT COUNT(*) as count FROM admins", (err, row) => {
        if (!err && row && row.count === 0) {
            // Main Admin / Super Admin (Access to ALL offices)
            db.run(`
                INSERT INTO admins (name, username, email, password, phone, office_id, role, status)
                VALUES ('Main Admin (Super)', 'main_admin', 'mainadmin@veronic.com', 'admin123', '+91 95100 75279', NULL, 'main_admin', 'Active')
            `, function(err) {
                if (!err) {
                    console.log('✅ Seeded default Super Main Admin (mainadmin@veronic.com / admin123)');
                }
            });

            // Rajkot Sub-Admin (Scoped to Rajkot Office)
            db.run(`
                INSERT INTO admins (name, username, email, password, phone, office_id, role, status)
                VALUES ('Rajkot Sub-Admin', 'rajkot_admin', 'rajkotadmin@veronic.com', 'admin123', '+91 98765 43210', 1, 'sub_admin', 'Active')
            `, function(err) {
                if (!err && this.lastID) {
                    const subAdminId = this.lastID;
                    const perms = ['dashboard', 'parcels', 'customers', 'drivers', 'delivery', 'billing', 'reports'];
                    const pStmt = db.prepare("INSERT INTO admin_permissions (admin_id, permission_key, is_granted) VALUES (?, ?, 1)");
                    perms.forEach(p => pStmt.run(subAdminId, p));
                    pStmt.finalize();
                    console.log('✅ Seeded default Rajkot Sub-Admin (rajkotadmin@veronic.com / admin123)');
                }
            });
        }
    });
}

function logAdminActivity(adminId, officeId, action, details, req) {
    const ip = req ? (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1') : '127.0.0.1';
    db.run(
        "INSERT INTO admin_activity_logs (admin_id, office_id, action, details, ip_address) VALUES (?, ?, ?, ?, ?)",
        [adminId || null, officeId || null, action, details || '', ip],
        () => {}
    );
}

// Middleware: Validate Admin Token
async function adminAuthMiddleware(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, error: 'Unauthorized: Admin authentication token required' });
    }
    const token = authHeader.split(' ')[1];
    db.get(`
        SELECT a.id, a.name, a.username, a.email, a.role, a.phone, a.status, a.office_id,
               o.office_name, o.office_code, o.city
        FROM admin_sessions s
        JOIN admins a ON s.admin_id = a.id
        LEFT JOIN offices o ON a.office_id = o.id
        WHERE s.token = ?
    `, [token], (err, admin) => {
        if (err || !admin) {
            return res.status(401).json({ success: false, error: 'Invalid or expired admin session' });
        }
        if (admin.status !== 'Active') {
            return res.status(403).json({ success: false, error: 'Admin account has been deactivated' });
        }

        // Fetch permissions for sub-admin
        db.all("SELECT permission_key FROM admin_permissions WHERE admin_id = ? AND is_granted = 1", [admin.id], (pErr, rows) => {
            admin.permissions = (rows || []).map(r => r.permission_key);
            req.admin = admin;
            next();
        });
    });
}

// ===== ADMIN AUTH ROUTES =====

// Admin Login
app.post('/api/admin/login', (req, res) => {
    const { usernameOrEmail, password } = req.body;
    if (!usernameOrEmail || !password) {
        return res.status(400).json({ success: false, error: 'Username/Email and Password are required' });
    }

    db.get(`
        SELECT a.*, o.office_name, o.office_code, o.city
        FROM admins a
        LEFT JOIN offices o ON a.office_id = o.id
        WHERE (a.username = ? OR a.email = ?) AND a.password = ?
    `, [usernameOrEmail, usernameOrEmail, password], (err, admin) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        if (!admin) return res.status(401).json({ success: false, error: 'Invalid username/email or password' });
        if (admin.status !== 'Active') return res.status(403).json({ success: false, error: 'Your admin account is currently inactive' });

        const token = 'adm_' + Date.now() + '_' + Math.random().toString(36).substring(2, 15);
        db.run("INSERT INTO admin_sessions (admin_id, token) VALUES (?, ?)", [admin.id, token], (sErr) => {
            if (sErr) return res.status(500).json({ success: false, error: sErr.message });

            db.run("UPDATE admins SET last_login = CURRENT_TIMESTAMP WHERE id = ?", [admin.id]);
            logAdminActivity(admin.id, admin.office_id, 'LOGIN', `${admin.name} logged into Admin Portal`, req);

            db.all("SELECT permission_key FROM admin_permissions WHERE admin_id = ? AND is_granted = 1", [admin.id], (pErr, rows) => {
                const permissions = (rows || []).map(r => r.permission_key);
                res.json({
                    success: true,
                    data: {
                        token,
                        admin: {
                            id: admin.id,
                            name: admin.name,
                            username: admin.username,
                            email: admin.email,
                            role: admin.role,
                            office_id: admin.office_id,
                            office_name: admin.office_name || (admin.role === 'main_admin' ? 'All Offices (Super Admin)' : 'N/A'),
                            office_code: admin.office_code || 'ALL',
                            city: admin.city || 'ALL',
                            permissions
                        }
                    }
                });
            });
        });
    });
});

// Admin Verify Token
app.get('/api/admin/verify', adminAuthMiddleware, (req, res) => {
    res.json({
        success: true,
        data: {
            admin: req.admin
        }
    });
});

// Admin Logout
app.post('/api/admin/logout', adminAuthMiddleware, (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader.split(' ')[1];
    db.run("DELETE FROM admin_sessions WHERE token = ?", [token], () => {
        logAdminActivity(req.admin.id, req.admin.office_id, 'LOGOUT', `${req.admin.name} logged out`, req);
        res.json({ success: true, message: 'Logged out successfully' });
    });
});

// ===== ADMIN GLOBAL STATS & OVERVIEW =====

app.get('/api/admin/stats', adminAuthMiddleware, async (req, res) => {
    try {
        const today = new Date().toISOString().slice(0, 10);
        const currentMonth = today.slice(0, 7);

        const offices = await dbAll("SELECT * FROM offices ORDER BY id ASC");
        const totalOffices = offices.length;

        const billsCount = await dbGet("SELECT COUNT(*) as count, SUM(total) as revenue FROM bills");
        const totalBills = billsCount.count || 0;
        const totalRevenue = billsCount.revenue || 0;

        const parcelsCount = await dbGet("SELECT SUM(qty) as total_qty FROM bill_items");
        const totalParcels = parcelsCount.total_qty || totalBills;

        const todayBills = await dbGet("SELECT COUNT(*) as count FROM bills WHERE date = ?", [today]);
        const todayParcels = todayBills.count || 0;

        const pendingBills = await dbGet("SELECT COUNT(*) as count FROM bills WHERE baki > 0");
        const pendingParcels = pendingBills.count || 0;

        const deliveredBills = await dbGet("SELECT COUNT(*) as count FROM bills WHERE baki = 0 OR baki IS NULL");
        const deliveredParcels = deliveredBills.count || 0;

        const driversRow = await dbGet("SELECT COUNT(*) as count FROM drivers WHERE status != 'Inactive'");
        const totalDrivers = driversRow.count || 0;

        const staffRow = await dbGet("SELECT COUNT(*) as count FROM admins WHERE status = 'Active'");
        const totalStaff = staffRow.count || 0;

        const custRow = await dbGet("SELECT COUNT(DISTINCT moklnar_mobile) as senders, COUNT(DISTINCT lenar_mobile) as receivers FROM bills");
        const totalCustomers = (custRow.senders || 0) + (custRow.receivers || 0);

        // Compute stats for each individual office
        const officesWithStats = await Promise.all(offices.map(async (off) => {
            const cityName = off.city || off.office_name;
            const offBills = await dbGet(`
                SELECT COUNT(DISTINCT b.id) as bills_count, SUM(b.total) as total_revenue,
                       SUM(CASE WHEN b.baki > 0 THEN 1 ELSE 0 END) as pending_count,
                       SUM(CASE WHEN b.baki = 0 OR b.baki IS NULL THEN 1 ELSE 0 END) as delivered_count
                FROM bills b
                LEFT JOIN bill_items bi ON b.id = bi.bill_id
                WHERE LOWER(bi.from_city) = LOWER(?) OR LOWER(bi.to_city) = LOWER(?)
            `, [cityName, cityName]);

            const offParcels = await dbGet(`
                SELECT SUM(bi.qty) as qty
                FROM bill_items bi
                WHERE LOWER(bi.from_city) = LOWER(?) OR LOWER(bi.to_city) = LOWER(?)
            `, [cityName, cityName]);

            const offDrivers = await dbGet(`
                SELECT COUNT(*) as count FROM drivers WHERE status = 'Active'
            `);

            return {
                ...off,
                total_parcels: offParcels.qty || offBills.bills_count || 0,
                pending_parcels: offBills.pending_count || 0,
                delivered_parcels: offBills.delivered_count || 0,
                total_bills: offBills.bills_count || 0,
                total_revenue: offBills.total_revenue || 0,
                total_drivers: Math.max(1, Math.floor(totalDrivers / Math.max(1, totalOffices))),
                total_customers: Math.max(2, Math.floor(totalCustomers / Math.max(1, totalOffices)))
            };
        }));

        res.json({
            success: true,
            data: {
                totalOffices,
                totalParcels,
                todayParcels,
                pendingParcels,
                deliveredParcels,
                totalCustomers,
                totalDrivers,
                totalStaff,
                totalBills,
                totalRevenue,
                offices: officesWithStats
            }
        });
    } catch (err) {
        console.error('Error fetching admin stats:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ===== OFFICES CRUD & DRILL-DOWN =====

// List all offices
app.get('/api/admin/offices', adminAuthMiddleware, async (req, res) => {
    try {
        const offices = await dbAll("SELECT * FROM offices ORDER BY id ASC");
        const officesWithStats = await Promise.all(offices.map(async (off) => {
            const cityName = off.city || off.office_name;
            const offBills = await dbGet(`
                SELECT COUNT(DISTINCT b.id) as bills_count, SUM(b.total) as total_revenue,
                       SUM(CASE WHEN b.baki > 0 THEN 1 ELSE 0 END) as pending_count,
                       SUM(CASE WHEN b.baki = 0 OR b.baki IS NULL THEN 1 ELSE 0 END) as delivered_count
                FROM bills b
                LEFT JOIN bill_items bi ON b.id = bi.bill_id
                WHERE LOWER(bi.from_city) = LOWER(?) OR LOWER(bi.to_city) = LOWER(?)
            `, [cityName, cityName]);

            const offParcels = await dbGet(`
                SELECT SUM(bi.qty) as qty
                FROM bill_items bi
                WHERE LOWER(bi.from_city) = LOWER(?) OR LOWER(bi.to_city) = LOWER(?)
            `, [cityName, cityName]);

            return {
                ...off,
                total_parcels: offParcels.qty || offBills.bills_count || 0,
                pending_parcels: offBills.pending_count || 0,
                delivered_parcels: offBills.delivered_count || 0,
                total_bills: offBills.bills_count || 0,
                total_revenue: offBills.total_revenue || 0
            };
        }));
        res.json({ success: true, data: officesWithStats });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Get single office
app.get('/api/admin/offices/:id', adminAuthMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        // Sub-admin boundary check
        if (req.admin.role === 'sub_admin' && req.admin.office_id != id) {
            return res.status(403).json({ success: false, error: 'Access denied: You can only view your assigned office' });
        }
        const office = await dbGet("SELECT * FROM offices WHERE id = ?", [id]);
        if (!office) return res.status(404).json({ success: false, error: 'Office not found' });
        res.json({ success: true, data: office });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Create new office (Main Admin only)
app.post('/api/admin/offices', adminAuthMiddleware, async (req, res) => {
    try {
        if (req.admin.role !== 'main_admin') {
            return res.status(403).json({ success: false, error: 'Only Main Admin can create offices' });
        }
        const { office_name, office_code, office_type, address, city, state, pincode, phone, email, manager, opening_time, closing_time, status } = req.body;
        if (!office_name || !office_code || !city) {
            return res.status(400).json({ success: false, error: 'Office Name, Office Code, and City are required' });
        }

        const existingCode = await dbGet("SELECT id FROM offices WHERE LOWER(office_code) = LOWER(?)", [office_code]);
        if (existingCode) {
            return res.status(400).json({ success: false, error: `Office Code "${office_code}" is already in use. Please enter a unique code.` });
        }

        db.run(`
            INSERT INTO offices (office_name, office_code, office_type, city, state, pincode, address, phone, email, manager, opening_time, closing_time, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            office_name,
            office_code,
            office_type || 'Branch',
            city,
            state || 'Gujarat',
            pincode || '',
            address || '',
            phone || '',
            email || '',
            manager || '',
            opening_time || '08:00 AM',
            closing_time || '09:00 PM',
            status || 'Active'
        ], function(err) {
            if (err) return res.status(500).json({ success: false, error: err.message });
            const newOfficeId = this.lastID;
            logAdminActivity(req.admin.id, newOfficeId, 'CREATE_OFFICE', `Created office ${office_name} (${office_code})`, req);
            res.json({
                success: true,
                message: 'Office created successfully',
                data: {
                    id: newOfficeId,
                    office_name,
                    office_code,
                    city,
                    manager
                }
            });
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Update office
app.put('/api/admin/offices/:id', adminAuthMiddleware, (req, res) => {
    const { id } = req.params;
    if (req.admin.role === 'sub_admin' && req.admin.office_id != id) {
        return res.status(403).json({ success: false, error: 'Access denied' });
    }
    const { office_name, office_code, office_type, address, city, state, pincode, phone, email, manager, opening_time, closing_time, status } = req.body;

    db.run(`
        UPDATE offices SET 
            office_name = ?, office_code = ?, office_type = ?, city = ?, state = ?, pincode = ?,
            address = ?, phone = ?, email = ?, manager = ?, opening_time = ?, closing_time = ?, status = ?
        WHERE id = ?
    `, [
        office_name,
        office_code,
        office_type || 'Branch',
        city || office_name,
        state || 'Gujarat',
        pincode || '',
        address || '',
        phone || '',
        email || '',
        manager || '',
        opening_time || '08:00 AM',
        closing_time || '09:00 PM',
        status || 'Active',
        id
    ], (err) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        logAdminActivity(req.admin.id, id, 'UPDATE_OFFICE', `Updated office ${office_name}`, req);
        res.json({ success: true, message: 'Office updated successfully' });
    });
});

// Delete office
app.delete('/api/admin/offices/:id', adminAuthMiddleware, (req, res) => {
    if (req.admin.role !== 'main_admin') {
        return res.status(403).json({ success: false, error: 'Only Main Admin can delete offices' });
    }
    const { id } = req.params;
    db.run("DELETE FROM offices WHERE id = ?", [id], (err) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        logAdminActivity(req.admin.id, id, 'DELETE_OFFICE', `Deleted office ID ${id}`, req);
        res.json({ success: true, message: 'Office deleted successfully' });
    });
});

// Specific Office Dashboard Metrics (Drill-Down)
app.get('/api/admin/offices/:id/dashboard', adminAuthMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        if (req.admin.role === 'sub_admin' && req.admin.office_id != id) {
            return res.status(403).json({ success: false, error: 'Access denied: You can only view your assigned office' });
        }

        const office = await dbGet("SELECT * FROM offices WHERE id = ?", [id]);
        if (!office) return res.status(404).json({ success: false, error: 'Office not found' });

        const cityName = office.city || office.office_name;
        const today = new Date().toISOString().slice(0, 10);

        // Office Bills
        const bills = await dbAll(`
            SELECT DISTINCT b.*, bi.from_city, bi.to_city, bi.qty, bi.description
            FROM bills b
            LEFT JOIN bill_items bi ON b.id = bi.bill_id
            WHERE LOWER(bi.from_city) = LOWER(?) OR LOWER(bi.to_city) = LOWER(?) OR LOWER(b.bus_no) LIKE ?
            ORDER BY b.date DESC, b.created_at DESC
        `, [cityName, cityName, `%${cityName}%`]);

        const totalBills = bills.length;
        const totalRevenue = bills.reduce((s, b) => s + (b.total || 0), 0);
        const todayBillsCount = bills.filter(b => b.date === today).length;
        const pendingCount = bills.filter(b => (b.baki || 0) > 0).length;
        const deliveredCount = bills.filter(b => (b.baki || 0) === 0).length;
        const inTransitCount = Math.max(0, Math.floor(pendingCount / 2));
        const totalParcels = bills.reduce((s, b) => s + (parseInt(b.qty) || 1), 0);

        // Office Staff / Admins
        const staff = await dbAll("SELECT id, name, username, email, phone, role, status, last_login FROM admins WHERE office_id = ?", [id]);

        // Drivers operating
        const drivers = await dbAll("SELECT * FROM drivers WHERE status = 'Active' LIMIT 8");

        res.json({
            success: true,
            data: {
                office,
                metrics: {
                    totalParcels,
                    todayParcels: todayBillsCount,
                    pending: pendingCount,
                    inTransit: inTransitCount,
                    delivered: deliveredCount,
                    cancelled: 0,
                    customers: Math.max(1, totalBills * 2),
                    drivers: drivers.length,
                    staff: staff.length,
                    bills: totalBills,
                    payments: totalRevenue,
                    revenue: totalRevenue
                },
                recentBills: bills.slice(0, 15),
                staff,
                drivers
            }
        });
    } catch (err) {
        console.error('Error in office dashboard:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ===== ADMIN & SUB-ADMIN MANAGEMENT =====

// List all admins
app.get('/api/admin/admins', adminAuthMiddleware, async (req, res) => {
    try {
        if (req.admin.role !== 'main_admin') {
            return res.status(403).json({ success: false, error: 'Access denied: Admin management is restricted to Main Admin' });
        }
        const admins = await dbAll(`
            SELECT a.id, a.name, a.username, a.email, a.password, a.phone, a.office_id, a.role, a.status, a.last_login, a.created_at,
                   o.office_name, o.office_code
            FROM admins a
            LEFT JOIN offices o ON a.office_id = o.id
            ORDER BY a.role DESC, a.created_at DESC
        `);

        // Attach permissions
        const adminsWithPerms = await Promise.all(admins.map(async (adm) => {
            const perms = await dbAll("SELECT permission_key FROM admin_permissions WHERE admin_id = ? AND is_granted = 1", [adm.id]);
            return {
                ...adm,
                permissions: perms.map(p => p.permission_key)
            };
        }));

        res.json({ success: true, data: adminsWithPerms });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Create new Sub-Admin
app.post('/api/admin/admins', adminAuthMiddleware, async (req, res) => {
    try {
        if (req.admin.role !== 'main_admin') {
            return res.status(403).json({ success: false, error: 'Only Main Admin can create admins' });
        }
        const { name, username, email, password, phone, office_id, role, status, permissions } = req.body;
        if (!name || !username || !email || !password) {
            return res.status(400).json({ success: false, error: 'Name, Username, Email, and Password are required' });
        }

        const existing = await dbGet("SELECT id FROM admins WHERE username = ? OR email = ?", [username, email]);
        if (existing) {
            return res.status(400).json({ success: false, error: 'Username or Email already registered' });
        }

        db.run(`
            INSERT INTO admins (name, username, email, password, phone, office_id, role, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [name, username, email, password, phone || '', office_id || null, role || 'sub_admin', status || 'Active'], function(err) {
            if (err) return res.status(500).json({ success: false, error: err.message });
            const newAdminId = this.lastID;

            // Insert permissions
            if (permissions && Array.isArray(permissions)) {
                const pStmt = db.prepare("INSERT INTO admin_permissions (admin_id, permission_key, is_granted) VALUES (?, ?, 1)");
                permissions.forEach(p => pStmt.run(newAdminId, p));
                pStmt.finalize();
            }

            logAdminActivity(req.admin.id, office_id, 'CREATE_ADMIN', `Created sub-admin ${name} (${username})`, req);
            res.json({ success: true, message: 'Sub-Admin created successfully', data: { id: newAdminId } });
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Update Sub-Admin
app.put('/api/admin/admins/:id', adminAuthMiddleware, (req, res) => {
    if (req.admin.role !== 'main_admin') {
        return res.status(403).json({ success: false, error: 'Only Main Admin can update admin accounts' });
    }
    const { id } = req.params;
    const { name, email, phone, office_id, role, status } = req.body;

    db.run(`
        UPDATE admins SET name = ?, email = ?, phone = ?, office_id = ?, role = ?, status = ?
        WHERE id = ?
    `, [name, email, phone, office_id || null, role || 'sub_admin', status || 'Active', id], (err) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        logAdminActivity(req.admin.id, office_id, 'UPDATE_ADMIN', `Updated admin ${name} (ID: ${id})`, req);
        res.json({ success: true, message: 'Admin updated successfully' });
    });
});

// Update Sub-Admin Permissions
app.put('/api/admin/admins/:id/permissions', adminAuthMiddleware, (req, res) => {
    if (req.admin.role !== 'main_admin') {
        return res.status(403).json({ success: false, error: 'Only Main Admin can modify permissions' });
    }
    const { id } = req.params;
    const { permissions } = req.body;

    db.run("DELETE FROM admin_permissions WHERE admin_id = ?", [id], (err) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        if (permissions && Array.isArray(permissions) && permissions.length > 0) {
            const pStmt = db.prepare("INSERT INTO admin_permissions (admin_id, permission_key, is_granted) VALUES (?, ?, 1)");
            permissions.forEach(p => pStmt.run(id, p));
            pStmt.finalize(() => {
                logAdminActivity(req.admin.id, null, 'UPDATE_PERMISSIONS', `Updated permissions for admin ID ${id}`, req);
                res.json({ success: true, message: 'Permissions updated successfully' });
            });
        } else {
            res.json({ success: true, message: 'Permissions cleared' });
        }
    });
});

// Reset Sub-Admin Password
app.put('/api/admin/admins/:id/reset-password', adminAuthMiddleware, (req, res) => {
    if (req.admin.role !== 'main_admin') {
        return res.status(403).json({ success: false, error: 'Only Main Admin can reset passwords' });
    }
    const { id } = req.params;
    const { password } = req.body;
    if (!password || password.length < 3) {
        return res.status(400).json({ success: false, error: 'Password must be at least 3 characters' });
    }

    db.run("UPDATE admins SET password = ? WHERE id = ?", [password, id], (err) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        // Invalidate active sessions
        db.run("DELETE FROM admin_sessions WHERE admin_id = ?", [id]);
        logAdminActivity(req.admin.id, null, 'RESET_PASSWORD', `Reset password for admin ID ${id}`, req);
        res.json({ success: true, message: 'Password reset successfully' });
    });
});

// Toggle Admin Status
app.put('/api/admin/admins/:id/status', adminAuthMiddleware, (req, res) => {
    if (req.admin.role !== 'main_admin') {
        return res.status(403).json({ success: false, error: 'Only Main Admin can toggle status' });
    }
    const { id } = req.params;
    const { status } = req.body;

    db.run("UPDATE admins SET status = ? WHERE id = ?", [status, id], (err) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        if (status === 'Inactive') {
            db.run("DELETE FROM admin_sessions WHERE admin_id = ?", [id]);
        }
        logAdminActivity(req.admin.id, null, 'TOGGLE_STATUS', `Set admin ID ${id} status to ${status}`, req);
        res.json({ success: true, message: `Admin status set to ${status}` });
    });
});

// Delete Sub-Admin
app.delete('/api/admin/admins/:id', adminAuthMiddleware, (req, res) => {
    if (req.admin.role !== 'main_admin') {
        return res.status(403).json({ success: false, error: 'Only Main Admin can delete admins' });
    }
    const { id } = req.params;
    db.run("DELETE FROM admins WHERE id = ? AND role != 'main_admin'", [id], function(err) {
        if (err) return res.status(500).json({ success: false, error: err.message });
        logAdminActivity(req.admin.id, null, 'DELETE_ADMIN', `Deleted admin ID ${id}`, req);
        res.json({ success: true, message: 'Admin deleted successfully' });
    });
});

// Activity Logs
app.get('/api/admin/activity-logs', adminAuthMiddleware, async (req, res) => {
    try {
        let query = `
            SELECT l.*, a.name as admin_name, a.role as admin_role, o.office_name, o.office_code
            FROM admin_activity_logs l
            LEFT JOIN admins a ON l.admin_id = a.id
            LEFT JOIN offices o ON l.office_id = o.id
        `;
        const params = [];
        if (req.admin.role === 'sub_admin') {
            query += ` WHERE l.office_id = ? OR l.admin_id = ?`;
            params.push(req.admin.office_id, req.admin.id);
        }
        query += ` ORDER BY l.created_at DESC LIMIT 50`;

        const logs = await dbAll(query, params);
        res.json({ success: true, data: logs });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Check username availability
app.get('/api/admin/check-username', adminAuthMiddleware, async (req, res) => {
    try {
        const { username } = req.query;
        if (!username) return res.json({ available: false, error: 'Username query required' });
        const existing = await dbGet("SELECT id FROM admins WHERE LOWER(username) = LOWER(?)", [username]);
        res.json({ available: !existing, exists: !!existing });
    } catch (err) {
        res.status(500).json({ available: false, error: err.message });
    }
});

// Admin Users / Members List
app.get('/api/admin/users', adminAuthMiddleware, async (req, res) => {
    try {
        let query = `
            SELECT u.id, u.name, u.email, u.password, u.office_id, u.role, u.status, u.created_at,
                   o.office_name, o.office_code, o.city, o.state
            FROM users u
            LEFT JOIN offices o ON u.office_id = o.id
        `;
        const params = [];
        if (req.admin.role === 'sub_admin') {
            query += ` WHERE u.office_id = ?`;
            params.push(req.admin.office_id);
        }
        query += ` ORDER BY u.id DESC`;

        const users = await dbAll(query, params);
        res.json({ success: true, data: users });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Create new User / Member
app.post('/api/admin/users', adminAuthMiddleware, async (req, res) => {
    try {
        const { name, email, password, office_id, role, status } = req.body;
        if (!name || !email || !password) {
            return res.status(400).json({ success: false, error: 'Name, Email, and Password are required' });
        }

        const existing = await dbGet("SELECT id FROM users WHERE LOWER(email) = LOWER(?)", [email]);
        if (existing) {
            return res.status(400).json({ success: false, error: 'User/Member with this email already exists' });
        }

        const targetOfficeId = (req.admin.role === 'sub_admin') ? req.admin.office_id : (office_id || 1);
        const userRole = role || 'member';
        const userStatus = status || 'Active';

        const result = await dbRun(
            "INSERT INTO users (name, email, password, office_id, role, status) VALUES (?, ?, ?, ?, ?, ?)",
            [name, email, password, targetOfficeId, userRole, userStatus]
        );

        logAdminActivity(req.admin.id, targetOfficeId, 'CREATE_MEMBER', `Created system member: ${name} (${email})`, req);
        res.json({ success: true, message: 'Member created successfully', data: { id: result.lastID } });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Reset User / Member Password
app.put('/api/admin/users/:id/reset-password', adminAuthMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { password } = req.body;
        if (!password || password.length < 3) {
            return res.status(400).json({ success: false, error: 'Password must be at least 3 characters' });
        }

        await dbRun("UPDATE users SET password = ? WHERE id = ?", [password, id]);
        logAdminActivity(req.admin.id, req.admin.office_id, 'RESET_MEMBER_PASSWORD', `Reset password for member #${id}`, req);
        res.json({ success: true, message: 'Member password reset successfully' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Toggle User / Member Status
app.put('/api/admin/users/:id/status', adminAuthMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        await dbRun("UPDATE users SET status = ? WHERE id = ?", [status, id]);
        logAdminActivity(req.admin.id, req.admin.office_id, 'UPDATE_MEMBER_STATUS', `Changed status to ${status} for member #${id}`, req);
        res.json({ success: true, message: 'Member status updated successfully' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Delete User / Member
app.delete('/api/admin/users/:id', adminAuthMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        await dbRun("DELETE FROM users WHERE id = ?", [id]);
        logAdminActivity(req.admin.id, req.admin.office_id, 'DELETE_MEMBER', `Deleted member #${id}`, req);
        res.json({ success: true, message: 'Member deleted successfully' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Admin Parcels List (Global / Scoped)
app.get('/api/admin/parcels', adminAuthMiddleware, async (req, res) => {
    try {
        let query = `
            SELECT b.*, bi.from_city, bi.to_city, bi.qty, bi.description
            FROM bills b
            LEFT JOIN bill_items bi ON b.id = bi.bill_id
        `;
        const params = [];
        if (req.admin.role === 'sub_admin') {
            const office = await dbGet("SELECT city, office_name FROM offices WHERE id = ?", [req.admin.office_id]);
            if (office) {
                const cityName = office.city || office.office_name;
                query += ` WHERE LOWER(bi.from_city) = LOWER(?) OR LOWER(bi.to_city) = LOWER(?) OR LOWER(b.bus_no) LIKE ?`;
                params.push(cityName, cityName, `%${cityName}%`);
            }
        }
        query += ` ORDER BY b.date DESC, b.created_at DESC LIMIT 100`;

        const parcels = await dbAll(query, params);
        res.json({ success: true, data: parcels });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Admin Reports Overview
app.get('/api/admin/reports', adminAuthMiddleware, async (req, res) => {
    try {
        const offices = await dbAll("SELECT * FROM offices ORDER BY id ASC");
        const monthlyStats = await dbAll(`
            SELECT strftime('%Y-%m', date) as month, COUNT(*) as total_bills, SUM(total) as revenue
            FROM bills
            GROUP BY strftime('%Y-%m', date)
            ORDER BY month DESC
            LIMIT 12
        `);
        res.json({ success: true, data: { offices, monthlyStats } });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ==============================================
// FIREBASE CLOUD & REALTIME DATABASE ENDPOINTS
// ==============================================

// 1. Get Firebase Client Configuration
app.get('/api/firebase/config', (req, res) => {
    res.json({
        success: true,
        data: {
            apiKey: firebaseService.FIREBASE_CONFIG.apiKey,
            authDomain: firebaseService.FIREBASE_CONFIG.authDomain,
            projectId: firebaseService.FIREBASE_CONFIG.projectId,
            storageBucket: firebaseService.FIREBASE_CONFIG.storageBucket,
            messagingSenderId: firebaseService.FIREBASE_CONFIG.messagingSenderId,
            appId: firebaseService.FIREBASE_CONFIG.appId,
            measurementId: firebaseService.FIREBASE_CONFIG.measurementId,
            databaseURL: firebaseService.FIREBASE_CONFIG.databaseURL
        }
    });
});

// 2. Get Firebase Sync Status for All Tables
app.get('/api/firebase/status', (req, res) => {
    res.json({
        success: true,
        projectId: firebaseService.FIREBASE_CONFIG.projectId,
        databaseURL: firebaseService.FIREBASE_CONFIG.databaseURL,
        allTables: firebaseService.ALL_TABLES,
        status: firebaseService.syncStatus
    });
});

// 3. Trigger Full Sync of All Tables to Firebase
app.post('/api/firebase/sync-all', async (req, res) => {
    try {
        const results = await firebaseService.syncAllTables(db);
        res.json({
            success: true,
            message: 'All tables synced to Firebase successfully',
            data: results,
            status: firebaseService.syncStatus
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: 'Failed to sync tables to Firebase: ' + err.message
        });
    }
});

// 4. Fetch Specific Table Data directly from Firebase
app.get('/api/firebase/data/:table', async (req, res) => {
    try {
        const tableName = req.params.table;
        const result = await firebaseService.getFirebaseTable(tableName);
        res.json({
            success: result.success,
            table: tableName,
            data: result.data,
            statusCode: result.statusCode,
            error: result.error
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve Firebase table data: ' + err.message
        });
    }
});

// ===== SERVE ADMIN STATIC PAGES & ROUTES =====

app.use('/admin', express.static(path.join(__dirname, 'public', 'admin')));

app.get('/admin/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin', 'login.html'));
});

app.get('/admin/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin', 'index.html'));
});

app.get('/admin/*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin', 'index.html'));
});

// ===== SERVE MAIN USER STATIC FILES =====

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});