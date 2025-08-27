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

async function main() {
    let conn;
    try {
        conn = await pool.getConnection();
        console.log('Connected to the database.');

        const stationConnections = JSON.parse(await fs.readFile(path.join(__dirname, 'src/data/stationConnections.json'), 'utf8'));

        for (const lineId in stationConnections) {
            if (stationConnections[lineId].estaciones) {
                for (const station of stationConnections[lineId].estaciones) {
                    const stationName = station.nombre;
                    const bikeConnections = station.bici || [];

                    if (bikeConnections.length > 0) {
                        const selectQuery = 'SELECT connections FROM metro_stations WHERE station_name = ?';
                        const rows = await conn.query(selectQuery, [stationName]);

                        if (rows.length > 0) {
                            const existingConnections = JSON.parse(rows[0].connections || '[]');
                            const allConnections = [...new Set([...existingConnections, ...bikeConnections.map(c => c.toLowerCase())])];

                            const updateQuery = 'UPDATE metro_stations SET connections = ? WHERE station_name = ?';
                            await conn.query(updateQuery, [JSON.stringify(allConnections), stationName]);
                            console.log(`Updated connections for station ${station.nombre}`);
                        } else {
                            console.log(`Station not found: ${station.nombre}`);
                        }
                    }
                }
            }
        }
    } catch (err) {
        console.error(err);
    } finally {
        if (conn) conn.release();
        pool.end();
    }
}

main();
