const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const http = require('http');

let mainWindow = null;
let serverInstance = null;

const PORT = process.env.PORT || 3001;

function checkServerReady(retries = 20, delay = 40) {
    return new Promise((resolve) => {
        const check = (remaining) => {
            const req = http.get(`http://127.0.0.1:${PORT}/api/firebase/config`, (res) => {
                if (res.statusCode === 200) {
                    resolve(true);
                } else {
                    retry(remaining);
                }
            });
            req.on('error', () => retry(remaining));
            req.setTimeout(150, () => {
                req.destroy();
                retry(remaining);
            });
            req.end();
        };

        const retry = (remaining) => {
            if (remaining <= 0) {
                resolve(false);
            } else {
                setTimeout(() => check(remaining - 1), delay);
            }
        };

        check(retries);
    });
}

async function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1024,
        minHeight: 700,
        title: 'VERONIC Fleet & Parcel Management System',
        icon: path.join(__dirname, 'images', 'logo.png'),
        backgroundColor: '#ffffff',
        show: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: false
        }
    });

    Menu.setApplicationMenu(null);

    // Fast check for backend server readiness (typically ready in < 50ms)
    const isReady = await checkServerReady(20, 40);

    if (isReady) {
        mainWindow.loadURL(`http://127.0.0.1:${PORT}/login.html`);
    } else {
        mainWindow.loadFile(path.join(__dirname, 'public', 'login.html'));
    }

    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
        console.warn('Page load failed:', errorCode, errorDescription);
        // Fallback directly to local login.html if URL load fails
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.loadFile(path.join(__dirname, 'public', 'login.html'));
        }
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.whenReady().then(() => {
    // Start backend server
    try {
        require('./server');
        console.log('✅ Backend server started in Electron');
    } catch (e) {
        console.error('Backend startup notice:', e.message);
    }

    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

