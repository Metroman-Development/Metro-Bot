const mariadb = require('mariadb');
const DataManager = require('./src/core/metro/data/DataManager');

const pool = mariadb.createPool({
    host: '127.0.0.1',
    user: 'metroapi',
    password: 'Metro256',
    database: 'MetroDB',
    connectionLimit: 5
});

async function loadLines(conn, lines) {
    console.log('Loading lines...');
    for (const lineId in lines) {
        const line = lines[lineId];
        const exists = await conn.query("SELECT 1 FROM metro_lines WHERE line_id = ?", [lineId]);
        if (exists.length === 0) {
            const query = `
                INSERT INTO metro_lines (line_id, line_name, line_description)
                VALUES (?, ?, ?)
            `;
            await conn.query(query, [
                line.id,
                line.name,
                line.message
            ]);
            console.log(`Inserted line ${lineId}`);
        } else {
            console.log(`Skipping existing line ${lineId}`);
        }
    }
    console.log('Lines loaded.');
}

async function loadStations(conn, stations) {
    console.log('Loading stations...');
    for (const stationId in stations) {
        const station = stations[stationId];
        const exists = await conn.query("SELECT 1 FROM metro_stations WHERE line_id = ? AND station_code = ?", [station.line, station.code]);
        if (exists.length === 0) {
            const query = `
                INSERT INTO metro_stations (line_id, station_code, station_name, display_order, commune, address, latitude, longitude, location, transports, services, accessibility, commerce, amenities, image_url, access_details)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, POINT(0, 0), ?, ?, ?, ?, ?, ?, ?)
            `;
            const accessibilityDetails = JSON.stringify(station.accessibility);

            try {
                await conn.query(query, [
                    station.line,
                    station.code,
                    station.name,
                    station.order,
                    station.commune,
                    null, // address
                    null, // latitude
                    null, // longitude
                    station.transports,
                    station.services,
                    accessibilityDetails,
                    station.commerce,
                    station.amenities,
                    station.imageUrl,
                    null // Old access_details, can be removed
                ]);
                console.log(`Inserted station ${station.name}`);
            } catch (error) {
                console.error(`Could not insert station ${station.name}: ${error.message}`);
                process.exit(1);
            }
        } else {
            console.log(`Skipping existing station ${station.name}`);
        }
    }
    console.log('Stations loaded.');
}

async function truncateTables(conn) {
    console.log('Truncating tables...');
    await conn.query('SET FOREIGN_KEY_CHECKS = 0;');
    await conn.query('TRUNCATE TABLE metro_stations;');
    await conn.query('TRUNCATE TABLE metro_lines;');
    await conn.query('SET FOREIGN_KEY_CHECKS = 1;');
    console.log('Tables truncated.');
}

async function main() {
    const dataManager = new DataManager();
    await dataManager.loadData();
    const stations = dataManager.getStations();
    const lines = dataManager.getLines();

    let conn;
    try {
        conn = await pool.getConnection();
        console.log('Connected to the database.');
        await truncateTables(conn);
        await loadLines(conn, lines);
        await loadStations(conn, stations);
    } catch (err) {
        console.error(err);
    } finally {
        if (conn) conn.release();
        pool.end();
    }
}

main();
