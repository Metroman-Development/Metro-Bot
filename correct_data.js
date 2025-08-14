require('dotenv').config();
const mariadb = require('mariadb');
const fs = require('fs').promises;
const path = require('path');

const pool = mariadb.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.METRODB_NAME,
    connectionLimit: 5
});

async function correctStationCodes(conn) {
    console.log('Correcting station codes...');
    const stationsData = JSON.parse(await fs.readFile(path.join(__dirname, 'src/data/stations.json'), 'utf8'));

    for (const lineId in stationsData) {
        const lineStations = stationsData[lineId];
        for (const stationName in lineStations) {
            const stationCode = stationName.replace(/\s/g, '').toUpperCase().substring(0, 20);
            const query = `
                UPDATE metro_stations
                SET station_code = ?
                WHERE station_name = ? AND line_id = ?
            `;
            const res = await conn.query(query, [stationCode, stationName, lineId]);
            if (res.affectedRows > 0) {
                console.log(`Updated station code for ${stationName} on line ${lineId} to ${stationCode}`);
            } else {
                console.log(`No station found for ${stationName} on line ${lineId}. It might not be in the database.`);
            }
        }
    }
    console.log('Station codes correction finished.');
}


async function main() {
    let conn;
    try {
        conn = await pool.getConnection();
        console.log('Connected to the database.');

        await correctStationCodes(conn);

    } catch (err) {
        console.error(err);
    } finally {
        if (conn) conn.release();
        pool.end();
    }
}

main();
