const { exec } = require('child_process');
const mariadb = require('mariadb');
const DatabaseManager = require('./src/core/database/DatabaseManager');
const DatabaseService = require('./src/core/database/DatabaseService');

const pool = mariadb.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.METRODB_NAME,
    connectionLimit: 5
});

async function runVerification() {
    console.log('--- Running Verification Script ---');

    // Step 1: Run the data loader
    console.log('\n[1/4] Running load_data.js to populate the database...');
    await new Promise((resolve, reject) => {
        const loaderProcess = exec('node load_data.js', (error, stdout, stderr) => {
            if (error) {
                console.error(`Error executing load_data.js: ${error}`);
                return reject(error);
            }
            if (stderr) {
                console.error(`load_data.js stderr: ${stderr}`);
            }
            console.log(`load_data.js stdout: ${stdout}`);
            resolve();
        });
    });
    console.log('Data loading complete.');

    // Step 2: Test the setAllStationsStatus function
    console.log('\n[2/4] Testing setAllStationsStatus...');
    let conn;
    try {
        conn = await pool.getConnection();
        const dbManager = new DatabaseManager({ pool: conn });
        const dbService = new DatabaseService(dbManager);

        await dbService.setAllStationsStatus('operativo', 'Estación Operativa');
        console.log('setAllStationsStatus executed successfully.');
    } catch (err) {
        console.error('Error during setAllStationsStatus test:', err);
    } finally {
        if (conn) conn.release();
    }

    // Step 3: Verify metro_stations data
    console.log('\n[3/4] Verifying metro_stations data...');
    try {
        conn = await pool.getConnection();
        const stations = await conn.query('SELECT station_id, station_name, line_id FROM metro_stations ORDER BY station_id LIMIT 5');
        console.log('First 5 stations from metro_stations:');
        console.table(stations);
        if (stations.length > 0 && stations[0].station_id === 1 && stations[0].station_name === 'San Pablo') {
            console.log('✅ Verification PASSED: San Pablo has station_id 1.');
        } else {
            console.log('❌ Verification FAILED: San Pablo does not have station_id 1 or is not the first station.');
        }
    } catch (err) {
        console.error('Error verifying metro_stations:', err);
    } finally {
        if (conn) conn.release();
    }

    // Step 4: Verify station_status data
    console.log('\n[4/4] Verifying station_status data...');
    try {
        conn = await pool.getConnection();
        const statuses = await conn.query('SELECT status_id, station_id, status_type_id, status_description, status_message FROM station_status ORDER BY station_id LIMIT 5');
        console.log('First 5 statuses from station_status:');
        console.table(statuses);

        const incompleteStatuses = statuses.filter(s => s.status_message === null);
        if (incompleteStatuses.length === 0) {
            console.log('✅ Verification PASSED: No incomplete status messages found.');
        } else {
            console.log(`❌ Verification FAILED: Found ${incompleteStatuses.length} incomplete status messages.`);
            console.table(incompleteStatuses);
        }

    } catch (err) {
        console.error('Error verifying station_status:', err);
    } finally {
        if (conn) conn.release();
        pool.end();
        console.log('\n--- Verification Script Finished ---');
    }
}

runVerification();
