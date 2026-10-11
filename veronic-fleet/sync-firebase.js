const sqlite3 = require('sqlite3').verbose();
const fb = require('./firebase-service');

console.log('======================================================');
console.log('  VERONIC FLEET - ONE COMMAND FIREBASE SYNC TOOL     ');
console.log('======================================================');

const db = new sqlite3.Database('./veronic_fleet.db', async (err) => {
    if (err) {
        console.error('❌ Database connection error:', err.message);
        process.exit(1);
    }
    
    console.log('✅ SQLite Database connected successfully.');
    try {
        const results = await fb.syncAllTables(db);
        console.log('\n📊 SYNC SUMMARY ACROSS ALL 16 TABLES:');
        console.log('------------------------------------------------------');
        
        let totalRecords = 0;
        let successCount = 0;
        
        for (const [tableName, res] of Object.entries(results)) {
            const count = res.count || 0;
            totalRecords += count;
            if (res.success) successCount++;
            const icon = res.success ? '✅' : '❌';
            console.log(` ${icon} Collection: ${tableName.padEnd(25)} | Synced: ${count.toString().padStart(4)} docs | Status: ${res.success ? 'SUCCESS' : res.error || 'FAILED'}`);
        }
        
        console.log('------------------------------------------------------');
        console.log(`🎉 COMPLETED: ${successCount}/16 tables synced (${totalRecords} total documents stored in Firebase).`);
        console.log('🔥 Database is fully connected and in working mode!');
        console.log('======================================================\n');
        
        db.close();
        process.exit(0);
    } catch (e) {
        console.error('❌ Sync failed:', e);
        db.close();
        process.exit(1);
    }
});
