# DropBook - Fleet & Parcel Management ERP

A modern Node.js + Express multi-office parcel and fleet management ERP system with SQLite as the default database and optional MySQL support.

## Project Structure

- `veronic-fleet/` — main application folder
- `veronic-fleet/server.js` — backend server entry point
- `veronic-fleet/public/` — frontend static files
- `veronic-fleet/veronic_fleet.db` — SQLite database file created automatically

## Requirements

Before running the project, install the following software:

1. Node.js and npm
   - Download from: https://nodejs.org/
   - Recommended version: Node.js 18+ or newer

2. XAMPP / LAMPP (optional, only if you want to use MySQL)
   - Download from: https://www.apachefriends.org/
   - Start the MySQL service from XAMPP Control Panel

3. Git (optional, for cloning the project)

## Install Dependencies

Open a terminal and go to the project folder:

```bash
cd /opt/lampp/htdocs/veronic-Parcel-Management-System/veronic-fleet
npm install
```

This will install all required packages from `package.json`, including:

- `express`
- `sqlite3`
- `mysql2`
- `cors`
- `body-parser`
- `nodemon` (for development mode)

## Database Setup

### SQLite (default)

The application uses SQLite by default.

- No separate installation is required.
- When the server starts, it will automatically create the database file `veronic_fleet.db` if it does not exist.
- The app will also create the required tables automatically.

### MySQL (optional)

The project also supports MySQL.

To use MySQL:

1. Start MySQL from XAMPP / LAMPP.
2. Make sure a database named `veronic_fleet` exists.
3. Set environment variables before running the server:

```bash
export MYSQL_HOST=localhost
export MYSQL_USER=root
export MYSQL_PASSWORD=
export MYSQL_DATABASE=veronic_fleet
```

If the database does not exist, the server tries to create it automatically.

## Run the Project

### Production mode

```bash
cd /opt/lampp/htdocs/veronic-Parcel-Management-System/veronic-fleet
npm start
```

### Development mode

```bash
cd /opt/lampp/htdocs/veronic-Parcel-Management-System/veronic-fleet
npm run dev
```

## Open the Application

Once the server is running, open:

- http://localhost:3001/
- http://localhost:3001/login.html

The backend server listens on port `3001` by default.

## Important Notes

- If `npm install` fails, make sure Node.js and npm are installed correctly.
- If the server cannot connect to MySQL, it will still continue using SQLite and log a warning.
- If you are using XAMPP, make sure the MySQL and Apache services are running.

## Useful Commands

```bash
npm install
npm start
npm run dev
```

## Login Credentials & Portals

### 👑 Main Admin & Multi-Office System

- **Admin Login Portal URL**: [http://localhost:3001/admin/login](http://localhost:3001/admin/login)
- **Admin Dashboard URL**: [http://localhost:3001/admin/dashboard](http://localhost:3001/admin/dashboard)

| Role | Username / Email | Password | Access Scope |
| :--- | :--- | :--- | :--- |
| **👑 Main Admin (Super)** | `mainadmin@veronic.com` (or `main_admin`) | `admin123` | **All Offices & Systemwide (Full Access)** |
| **🏢 Rajkot Sub-Admin** | `rajkotadmin@veronic.com` (or `rajkot_admin`) | `admin123` | **Rajkot Central Office (OFF-001)** |

---

### 👤 Standard User Application

- **User Application URL**: [http://localhost:3001/](http://localhost:3001/)
- **User Login URL**: [http://localhost:3001/login.html](http://localhost:3001/login.html)

| Account | Email | Password |
| :--- | :--- | :--- |
| **Admin User** | `admin@veronic.com` | `admin123` |
| **Demo User** | `demo@example.com` | `demo` |
| **Simple User** | `user@simple.com` | `123` |



