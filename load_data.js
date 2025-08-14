const mariadb = require('mariadb');
const fs = require('fs').promises;
const path = require('path');

const pool = mariadb.createPool({
    host: '127.0.0.1',
    user: 'metroapi',
    password: 'Metro256',
    database: 'MetroDB',
    connectionLimit: 5
});

async function loadLines() {
    const estadoRedPath = path.join(__dirname, 'src', 'data', 'estadoRed.json');
    const estadoRedData = JSON.parse(await fs.readFile(estadoRedPath, 'utf8'));

    let conn;
    try {
        conn = await pool.getConnection();
        console.log('Connected to the database.');

        for (const lineId in estadoRedData) {
            const line = estadoRedData[lineId];
            const exists = await conn.query("SELECT 1 FROM metro_lines WHERE line_id = ?", [lineId]);
            if (exists.length === 0) {
                const query = `
                    INSERT INTO metro_lines (line_id, line_name, line_description)
                    VALUES (?, ?, ?)
                `;
                await conn.query(query, [
                    lineId,
                    `Línea ${lineId.toUpperCase()}`,
                    line['mensaje_app']
                ]);
                console.log(`Inserted line ${lineId}`);
            } else {
                console.log(`Skipping existing line ${lineId}`);
            }
        }
    } catch (err) {
        console.error(err);
    } finally {
        if (conn) conn.release();
    }
}

async function loadStations() {
    const stationsDataPath = path.join(__dirname, 'src', 'data', 'stationsData.json');
    const stationsData = JSON.parse(await fs.readFile(stationsDataPath, 'utf8')).stationsData;

    const accessDetailsPath = path.join(__dirname, 'src', 'data', 'accessDetails');
    const accessFiles = await fs.readdir(accessDetailsPath);

    const accessDetails = {};
    for (const file of accessFiles) {
        if (file.endsWith('.json')) {
            const stationKey = file.replace('access_', '').replace('.json', '');
            const content = await fs.readFile(path.join(accessDetailsPath, file), 'utf8');
            accessDetails[stationKey] = JSON.parse(content);
        }
    }

    const estadoRedPath = path.join(__dirname, 'src', 'data', 'estadoRed.json');
    const estadoRedData = JSON.parse(await fs.readFile(estadoRedPath, 'utf8'));

    let conn;
    try {
        conn = await pool.getConnection();
        console.log('Loading stations...');

        for (const lineId in estadoRedData) {
            const line = estadoRedData[lineId];
            for (const station of line.estaciones) {
                const stationName = station.nombre;
                const stationData = stationsData[stationName.toLowerCase()];

                if (!stationData) {
                    console.log(`Skipping station ${stationName} because it is not in stationsData.json`);
                    continue;
                }

                const query = `
                    INSERT INTO metro_stations (line_id, station_code, station_name, commune, address, latitude, longitude, location, transports, services, accessibility, commerce, amenities, image_url, access_details)
                    VALUES (?, ?, ?, ?, ?, ?, ?, POINT(0, 0), ?, ?, ?, ?, ?, ?, ?)
                `;

                const stationKey = stationName.replace(/ /g, '-').toLowerCase();
                const access_details = accessDetails[stationKey] ? JSON.stringify(accessDetails[stationKey]) : null;

                const exists = await conn.query("SELECT 1 FROM metro_stations WHERE line_id = ? AND station_code = ?", [lineId, station.codigo]);
                if (exists.length === 0) {
                    try {
                        await conn.query(query, [
                            lineId,
                            station.codigo,
                            station.nombre,
                            stationData[6] || null,
                            null, // address
                            null, // latitude
                            null, // longitude
                            stationData[0], // transports
                            stationData[1], // services
                            stationData[2], // accessibility
                            stationData[3], // commerce
                            stationData[4], // amenities
                            stationData[5], // image_url
                            access_details
                        ]);
                        console.log(`Inserted station ${stationName}`);
                    } catch (error) {
                        console.error(`Could not insert station ${stationName}: ${error.message}`);
                        process.exit(1);
                    }
                } else {
                    console.log(`Skipping existing station ${stationName}`);
                }
            }
        }
    } catch (err) {
        console.error(err);
    } finally {
        if (conn) conn.release();
    }
}

async function truncateTables() {
    let conn;
    try {
        conn = await pool.getConnection();
        console.log('Truncating tables...');
        await conn.query('SET FOREIGN_KEY_CHECKS = 0;');
        await conn.query('TRUNCATE TABLE metro_stations;');
        await conn.query('TRUNCATE TABLE metro_lines;');
        await conn.query('SET FOREIGN_KEY_CHECKS = 1;');
        console.log('Tables truncated.');
    } catch (err) {
        console.error(err);
    } finally {
        if (conn) conn.release();
    }
}

async function main() {
    await truncateTables();
    await loadLines();
    await loadStations();
    pool.end();
}

main();
