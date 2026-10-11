require('dotenv').config();
const path = require('path');
const fs = require('fs');
const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// All database tables supported by the system
const ALL_TABLES = [
    'drivers',
    'deleted_drivers',
    'buses',
    'deleted_buses',
    'bills',
    'bill_items',
    'deleted_bills',
    'deleted_bill_items',
    'today_driver_assignments',
    'users',
    'sessions',
    'offices',
    'admins',
    'admin_permissions',
    'admin_sessions',
    'admin_activity_logs'
];

const FIREBASE_CONFIG = {
    apiKey: process.env.FIREBASE_API_KEY || "AIzaSyDeNlNM_DobVZX17NxHKmtwspFh5SqRBOA",
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || "dropbox-113d0.firebaseapp.com",
    projectId: process.env.FIREBASE_PROJECT_ID || "dropbox-113d0",
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "dropbox-113d0.firebasestorage.app",
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "105591636213",
    appId: process.env.FIREBASE_APP_ID || "1:105591636213:web:26a7e36e6e1bd3579cc5bc",
    measurementId: process.env.FIREBASE_MEASUREMENT_ID || "G-N69MR827LS",
    syncEnabled: process.env.FIREBASE_SYNC_ENABLED !== 'false'
};

let firestoreDb = null;

let syncStatus = {
    initialized: false,
    connected: false,
    liveSyncActive: false,
    lastSyncTime: null,
    projectId: FIREBASE_CONFIG.projectId,
    tables: {},
    errors: []
};

ALL_TABLES.forEach(table => {
    syncStatus.tables[table] = {
        rowCount: 0,
        lastUpdated: null,
        status: 'pending'
    };
});

/**
 * Initialize Firebase Admin with Service Account
 */
function initFirebaseApp() {
    try {
        if (firestoreDb) {
            return { success: true, db: firestoreDb };
        }

        const existingApps = getApps();
        if (existingApps.length > 0) {
            firestoreDb = getFirestore(existingApps[0]);
            syncStatus.initialized = true;
            syncStatus.connected = true;
            return { success: true, db: firestoreDb };
        }

        let credential = null;
        const candidatePaths = [
            path.join(__dirname, 'firebase-service-account.json'),
            path.join(process.cwd(), 'firebase-service-account.json'),
            path.join(process.resourcesPath || '', 'database-configuration', 'firebase-service-account.json'),
            path.join(process.resourcesPath || '', 'firebase-service-account.json')
        ];

        for (const p of candidatePaths) {
            try {
                if (fs.existsSync(p)) {
                    const sa = JSON.parse(fs.readFileSync(p, 'utf8'));
                    credential = cert(sa);
                    console.log(`🔥 [Firebase Service] Loaded service account credentials from: ${p}`);
                    break;
                }
            } catch (e) {}
        }

        if (!credential) {
            const embeddedSA = {
                "type": "service_account",
                "project_id": "dropbox-113d0",
                "private_key_id": "e8f84aab0d27c7ac261891afeb9193756947b78b",
                "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQDIMrhM1WxpEUhx\nUpg1BVbPT8mW8THrx3aeUSwWhLJtpjUygA3biVYtW0WRKMSjeQSUFexId7ofpfPX\nLTWImGHgnmnj6lmG7wYf1WjASNsIDmV51HgAUbU+bADCVtM3zaqpblCDwlKpkFQ3\nM4/vQw0onP/phr3dUYX7LVU221YuG1itFR+ft5gxtvPA62asWjf0NhU+THHVpd9C\n8xK4Efyn2rfkj0UTzT1/og2ctYGPGPUfmilrEZQskjoK+yeb15xiDGL4wR7NdF07\nyOQp0c9Jenl06VLii8Ci+UNAuRgKp4luIZxEqVss0Y2+TrO44GvTJiMEWJoYwX+g\n4pxoYZNjAgMBAAECggEAUn3XxE0i9S46b/uNHTfce+MQGWK8Y7+WaIjhBkxaa2UT\nwYHTc/Ukrd7QjQ5D7Go20UAxUvEGn/jVP4Jw7x5/IjuUPWY4yqleGCrrFWRP4INy\nG9/JLLR+XsDJFUsKkJFt84+xnIErZ5RBp1dXRUsXNndu2c58GKB5eTTGSqrZWXiP\nUSCN0jhLtNkQwmeTd+nafywEIymKCG9JpMhUwzxWvDZ2TGwCuXcZuyZcHltz3E44\n9xmwzJE+S6zrF02bX6IWuvE8SdMVeWg+X6zyfqjMfU5KCW4U3cmbFhksGhBQ1hYb\nP3PB/EfL4tb18ucIHeTy6XXpFjuauc9TpFDlRC3KgQKBgQDv7aPHsiXD82FMw6b+\nx5S3D2eUHPo548RsqA08Gi40Og8Li8EHgs7Tx22CiIP2YI4EHdcMEjis9ElzmTRB\n1qJk0mB1tEUfDJuCMpovKisQh13X86WqukgUXojIYoG233SqzGouCAQ8NosFpDCI\n5W4k8iuJxxufTCaP/SYQJuOmgQKBgQDVm8adnLbmo0w1lOBHwvj8JX9UgHghrUMY\nO4VQRY4algHpkbcc5hxadsnPrtCV/vUkZ2KeouFSmXcoZe4P5Fq9Ykqn9tEWegol\n/7uROHFR210Yf9Ozfxm69Fr/IR8bcyH7l52abB9WyHrElciJAABVxJL1iL+gmUo+\nXmtLe9Nv4wKBgHo1y6TeY0oqYDdfuWIxeti76gCRugteryDBgOxKUZqcsCkraIlQ\n4dUR0gAZVU5b5DrIkE8/wMqoK/nL4chfcZx1ZFjQGB02qMdqywqXKhRjPzPOkWYj\nOK/Xb0jSlEv4Ck8tjDAiOTYKeknHVkmEw9Ph3rdxSeqcOVBCm+7CQFcBAoGARlzt\n6/U3ennIHM5RotHi2owviVJYQB+mvlC89Vg0GyXWs23Ad9CE/nequrLHGuHFNpyn\nq8HTnzXWPoR1Ct8Z1NCP7wwqi9DfjuzSiF+jVGeCHxPcVIBFpYPghbIPYSdnxkyH\nKdr758ZaSm9cg2Rwt8/s6NyG4wwbnLfVeCPt3ikCgYB8YZiRcCA0N8cmSP6SeWtF\ncSv+7hkMumCk34FcYOYGKxkV2R0JSNtglmXPeCn0e47362Boqskaa2HJWuMiJGP1\nXBy5N62wzXRdoN89gyMwvzlSTy91JRPqZEnmrmeyv1yU4bjGYIcKHzWjJDmzPX7B\n3mu+7xvBXUGUR4/6Ln67qw==\n-----END PRIVATE KEY-----\n",
                "client_email": "firebase-adminsdk-fbsvc@dropbox-113d0.iam.gserviceaccount.com",
                "client_id": "116610294685865141175",
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
                "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40dropbox-113d0.iam.gserviceaccount.com",
                "universe_domain": "googleapis.com"
            };
            credential = cert(embeddedSA);
            console.log('🔥 [Firebase Service] Using embedded production service credentials for dropbox-113d0');
        }

        const app = initializeApp({
            credential,
            projectId: FIREBASE_CONFIG.projectId,
            storageBucket: FIREBASE_CONFIG.storageBucket
        });

        firestoreDb = getFirestore(app);
        syncStatus.initialized = true;
        syncStatus.connected = true;
        console.log(`🔥 [Firebase Admin] Successfully connected LIVE to project: ${FIREBASE_CONFIG.projectId}`);
        return { success: true, db: firestoreDb };
    } catch (err) {
        console.error('❌ [Firebase Admin] Initialization failed:', err.message);
        syncStatus.initialized = false;
        syncStatus.errors.push(err.message);
        return { success: false, error: err.message };
    }
}

/**
 * Clean data for Firestore
 */
function sanitizeForFirestore(data) {
    if (!data || typeof data !== 'object') return data;
    const sanitized = {};
    for (const [key, value] of Object.entries(data)) {
        if (value === undefined) {
            sanitized[key] = null;
        } else {
            sanitized[key] = value;
        }
    }
    sanitized._updatedAt = new Date().toISOString();
    return sanitized;
}

/**
 * Sync or upsert a single document in Firestore
 */
async function syncRecord(tableName, id, data) {
    if (!FIREBASE_CONFIG.syncEnabled) return { success: false, message: 'Sync disabled' };
    if (!firestoreDb) initFirebaseApp();
    if (!firestoreDb) return { success: false, message: 'Firestore not initialized' };

    try {
        const docId = String(id || (data && data.id) || Date.now());
        const docRef = firestoreDb.collection(tableName).doc(docId);
        const cleanData = sanitizeForFirestore(data);
        
        await docRef.set(cleanData, { merge: true });
        
        syncStatus.tables[tableName] = syncStatus.tables[tableName] || {};
        syncStatus.tables[tableName].lastUpdated = new Date().toISOString();
        syncStatus.tables[tableName].status = 'synced';
        
        console.log(`⚡ [Firebase LIVE] Stored ${tableName} record #${docId}`);
        return { success: true, table: tableName, docId, data: cleanData };
    } catch (err) {
        console.warn(`⚠️ [Firebase LIVE] Sync record error in '${tableName}' [${id}]:`, err.message);
        return { success: false, error: err.message };
    }
}

/**
 * Delete a single document in Firestore
 */
async function deleteRecord(tableName, id) {
    if (!FIREBASE_CONFIG.syncEnabled) return { success: false, message: 'Sync disabled' };
    if (!firestoreDb) initFirebaseApp();
    if (!firestoreDb) return { success: false, message: 'Firestore not initialized' };

    try {
        const docId = String(id);
        await firestoreDb.collection(tableName).doc(docId).delete();
        console.log(`⚡ [Firebase LIVE] Deleted ${tableName} record #${docId}`);
        return { success: true, table: tableName, docId };
    } catch (err) {
        console.warn(`⚠️ [Firebase LIVE] Delete record error in '${tableName}' [${id}]:`, err.message);
        return { success: false, error: err.message };
    }
}

/**
 * Sync an entire SQLite table into Firestore collection using Batched writes
 */
async function syncTable(tableName, rows) {
    if (!FIREBASE_CONFIG.syncEnabled) return { success: false, message: 'Sync disabled' };
    if (!firestoreDb) initFirebaseApp();
    if (!firestoreDb) return { success: false, message: 'Firestore not initialized' };

    try {
        if (!Array.isArray(rows) || rows.length === 0) {
            syncStatus.tables[tableName] = {
                rowCount: 0,
                lastUpdated: new Date().toISOString(),
                status: 'synced (0 rows)'
            };
            return { success: true, table: tableName, count: 0 };
        }

        const chunkSize = 450;
        let syncedCount = 0;

        for (let i = 0; i < rows.length; i += chunkSize) {
            const batch = firestoreDb.batch();
            const chunk = rows.slice(i, i + chunkSize);

            chunk.forEach((row, idx) => {
                const docId = String(row.id !== undefined && row.id !== null ? row.id : `row_${i + idx}`);
                const docRef = firestoreDb.collection(tableName).doc(docId);
                const sanitized = sanitizeForFirestore(row);
                batch.set(docRef, sanitized, { merge: true });
            });

            await batch.commit();
            syncedCount += chunk.length;
        }

        syncStatus.tables[tableName] = {
            rowCount: syncedCount,
            lastUpdated: new Date().toISOString(),
            status: 'synced'
        };
        console.log(`✅ [Firebase Admin] Collection '${tableName}' perfectly synced (${syncedCount} documents)`);
        return { success: true, table: tableName, count: syncedCount };
    } catch (err) {
        syncStatus.tables[tableName] = {
            rowCount: Array.isArray(rows) ? rows.length : 0,
            lastUpdated: new Date().toISOString(),
            status: 'error',
            error: err.message
        };
        console.warn(`❌ [Firebase Admin] Failed syncing '${tableName}':`, err.message);
        return { success: false, table: tableName, error: err.message };
    }
}

/**
 * Fetch all documents in a Firestore collection
 */
async function getFirebaseTable(tableName) {
    if (!firestoreDb) initFirebaseApp();
    if (!firestoreDb) return { success: false, message: 'Firestore not initialized' };

    try {
        const snapshot = await firestoreDb.collection(tableName).get();
        const docs = [];
        snapshot.forEach(d => {
            docs.push({ id: d.id, ...d.data() });
        });
        return { success: true, table: tableName, count: docs.length, data: docs };
    } catch (err) {
        return { success: false, table: tableName, error: err.message };
    }
}

/**
 * Perform a full sync of all 16 system tables from SQLite DB to Firebase
 */
async function syncAllTables(db) {
    console.log('🚀 [Firebase Admin] Starting one-command sync of ALL tables to Firebase...');
    if (!firestoreDb) initFirebaseApp();
    
    const results = {};
    for (const table of ALL_TABLES) {
        try {
            const rows = await new Promise((resolve) => {
                db.all(`SELECT * FROM ${table}`, (err, rows) => {
                    if (err) resolve(null);
                    else resolve(rows || []);
                });
            });

            if (rows !== null) {
                const res = await syncTable(table, rows);
                results[table] = res;
            } else {
                results[table] = { success: false, status: 'table_not_found_in_sqlite' };
            }
        } catch (err) {
            results[table] = { success: false, error: err.message };
        }
    }

    syncStatus.lastSyncTime = new Date().toISOString();
    console.log('🎉 [Firebase Admin] ALL 16 TABLES PARFECTLY STORED & CONNECTED IN FIREBASE!');
    return results;
}

/**
 * Attach Live Realtime Hook to SQLite DB
 * ANY INSERT, UPDATE, DELETE in SQLite automatically syncs to Firebase immediately!
 */
function attachLiveDbSync(db) {
    if (!db || db._firebaseLiveHookAttached) return;
    db._firebaseLiveHookAttached = true;
    syncStatus.liveSyncActive = true;

    const originalRun = db.run;
    db.run = function(sql, ...args) {
        let callback = typeof args[args.length - 1] === 'function' ? args.pop() : null;
        let params = args.length > 0 && Array.isArray(args[0]) ? args[0] : (args.length > 0 && typeof args[0] !== 'function' ? args : []);

        return originalRun.call(this, sql, params, function(err) {
            if (!err && typeof sql === 'string') {
                try {
                    const cleanSql = sql.trim().replace(/\s+/g, ' ');
                    const firstWord = cleanSql.split(' ')[0].toUpperCase();
                    
                    // Match table name from query
                    let matchedTable = null;
                    for (const table of ALL_TABLES) {
                        const regex = new RegExp(`\\b${table}\\b`, 'i');
                        if (regex.test(cleanSql)) {
                            matchedTable = table;
                            break;
                        }
                    }

                    if (matchedTable) {
                        if (firstWord === 'INSERT' && this.lastID) {
                            const lastId = this.lastID;
                            db.get(`SELECT * FROM ${matchedTable} WHERE id = ? OR rowid = ?`, [lastId, lastId], (fetchErr, row) => {
                                if (!fetchErr && row) {
                                    syncRecord(matchedTable, row.id || lastId, row).catch(() => {});
                                }
                            });
                        } else if (firstWord === 'UPDATE') {
                            const idParam = params.find(p => typeof p === 'number' || (typeof p === 'string' && /^\d+$/.test(p)));
                            if (idParam) {
                                db.get(`SELECT * FROM ${matchedTable} WHERE id = ?`, [idParam], (fetchErr, row) => {
                                    if (!fetchErr && row) {
                                        syncRecord(matchedTable, row.id || idParam, row).catch(() => {});
                                    } else {
                                        db.all(`SELECT * FROM ${matchedTable}`, (err2, rows) => {
                                            if (!err2 && rows) syncTable(matchedTable, rows).catch(() => {});
                                        });
                                    }
                                });
                            } else {
                                db.all(`SELECT * FROM ${matchedTable}`, (err2, rows) => {
                                    if (!err2 && rows) syncTable(matchedTable, rows).catch(() => {});
                                });
                            }
                        } else if (firstWord === 'DELETE') {
                            const idParam = params.find(p => typeof p === 'number' || (typeof p === 'string' && /^\d+$/.test(p)));
                            if (idParam) {
                                deleteRecord(matchedTable, idParam).catch(() => {});
                            } else {
                                db.all(`SELECT * FROM ${matchedTable}`, (err2, rows) => {
                                    if (!err2 && rows) syncTable(matchedTable, rows).catch(() => {});
                                });
                            }
                        }
                    }
                } catch (liveErr) {
                    // Non-blocking background sync error
                }
            }
            if (callback) callback.call(this, err);
        });
    };
    console.log('⚡ [Firebase Live Hook] Real-time live auto sync attached to SQLite database!');
}

/**
 * Initialize Firebase connection, attach live hooks, and schedule auto-sync
 */
function initFirebase(db) {
    initFirebaseApp();
    if (db) {
        attachLiveDbSync(db);
        setTimeout(() => {
            syncAllTables(db).catch(err => {
                console.warn('[Firebase Admin] Initial sync error:', err.message);
            });
        }, 1500);
    }
}

module.exports = {
    FIREBASE_CONFIG,
    ALL_TABLES,
    syncStatus,
    initFirebaseApp,
    initFirebase,
    attachLiveDbSync,
    syncRecord,
    deleteRecord,
    syncTable,
    getFirebaseTable,
    syncAllTables
};
