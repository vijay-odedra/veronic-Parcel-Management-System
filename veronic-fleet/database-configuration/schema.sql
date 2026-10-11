CREATE TABLE drivers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            mobile TEXT DEFAULT '0000000000',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        , license_no TEXT, status TEXT DEFAULT 'Active', office_id INTEGER DEFAULT 1);

CREATE TABLE sqlite_sequence(name,seq);

CREATE TABLE bill_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            bill_id INTEGER NOT NULL,
            from_city TEXT NOT NULL,
            to_city TEXT NOT NULL,
            description TEXT,
            qty INTEGER DEFAULT 1,
            remark TEXT,
            amount REAL NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE
        );

CREATE TABLE buses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            bus_number TEXT NOT NULL UNIQUE,
            assigned_driver_id INTEGER,
            status TEXT DEFAULT 'Active',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, bus_type TEXT DEFAULT 'AC Sleeper (2+1)', route TEXT DEFAULT 'Rajkot – Surat', office_id INTEGER DEFAULT 1,
            FOREIGN KEY (assigned_driver_id) REFERENCES drivers(id) ON DELETE SET NULL
        );

CREATE TABLE bills (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            bill_no TEXT NOT NULL UNIQUE,
            date TEXT NOT NULL,
            driver_name TEXT NOT NULL,
            bus_no TEXT NOT NULL,
            moklnar_name TEXT NOT NULL,
            moklnar_mobile TEXT,
            lenar_name TEXT NOT NULL,
            lenar_mobile TEXT,
            total REAL NOT NULL DEFAULT 0,
            jama REAL NOT NULL DEFAULT 0,
            baki REAL NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        , office_id INTEGER DEFAULT 1);

CREATE INDEX idx_bills_bill_no ON bills(bill_no);

CREATE INDEX idx_drivers_name ON drivers(name);

CREATE INDEX idx_buses_bus_number ON buses(bus_number);

CREATE INDEX idx_bill_items_bill_id ON bill_items(bill_id);

CREATE INDEX idx_bills_date ON bills(date);

CREATE TABLE deleted_bills (
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
        , office_id INTEGER DEFAULT 1);

CREATE TABLE deleted_bill_items (
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
        );

CREATE TABLE deleted_buses (
            id INTEGER,
            bus_number TEXT NOT NULL,
            assigned_driver_id INTEGER,
            status TEXT,
            created_at DATETIME,
            deleted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            deleted_by TEXT DEFAULT 'user'
        , office_id INTEGER DEFAULT 1);

CREATE TABLE deleted_drivers (
            id INTEGER,
            name TEXT NOT NULL,
            mobile TEXT,
            created_at DATETIME,
            deleted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            deleted_by TEXT DEFAULT 'user'
        , office_id INTEGER DEFAULT 1);

CREATE TABLE users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        , office_id INTEGER DEFAULT 1, role TEXT DEFAULT 'member', status TEXT DEFAULT 'Active');

CREATE TABLE sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            token TEXT UNIQUE NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            expires_at DATETIME,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

CREATE TABLE today_driver_assignments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            bus_id INTEGER NOT NULL,
            driver_id INTEGER NOT NULL,
            assigned_date DATE NOT NULL DEFAULT CURRENT_DATE,
            assigned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, office_id INTEGER DEFAULT 1,
            FOREIGN KEY (bus_id) REFERENCES buses(id) ON DELETE CASCADE,
            FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE,
            UNIQUE (bus_id, assigned_date),
            UNIQUE (driver_id, assigned_date)
        );

CREATE TABLE offices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            office_name TEXT NOT NULL,
            office_code TEXT UNIQUE NOT NULL,
            city TEXT NOT NULL,
            address TEXT,
            phone TEXT,
            email TEXT,
            manager TEXT,
            status TEXT DEFAULT 'Active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        , office_type TEXT DEFAULT 'Branch', closing_time TEXT DEFAULT '09:00 PM', pincode TEXT, opening_time TEXT DEFAULT '08:00 AM', state TEXT DEFAULT 'Gujarat');

CREATE TABLE admins (
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
                );

CREATE TABLE admin_permissions (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            admin_id INTEGER NOT NULL,
                            permission_key TEXT NOT NULL,
                            is_granted INTEGER DEFAULT 1,
                            FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE,
                            UNIQUE(admin_id, permission_key)
                        );

CREATE TABLE admin_sessions (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            admin_id INTEGER NOT NULL,
                            token TEXT UNIQUE NOT NULL,
                            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                            expires_at DATETIME,
                            FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
                        );

CREATE TABLE admin_activity_logs (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            admin_id INTEGER,
                            office_id INTEGER,
                            action TEXT NOT NULL,
                            details TEXT,
                            ip_address TEXT,
                            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                        );