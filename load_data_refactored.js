require('dotenv').config();
const mariadb = require('mariadb');
const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const schedule = require('node-schedule');
const normalizer = require('./src/core/metro/utils/stringHandlers/normalization');

const pool = mariadb.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.METRODB_NAME,
    connectionLimit: 5
});

const ESTADO_RED_URL = 'https://www.metro.cl/api/estadoRedDetalle.php';
const ACCESS_ARIEL_URL = 'https://velocidades.seguimos.cl/?metro=1';

function getChecksum(data) {
    return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
}

async function getLastChecksum(conn, loaderName) {
    const query = 'SELECT checksum FROM loader_raw_data WHERE loader_name = ? ORDER BY ingested_at DESC LIMIT 1';
    const rows = await conn.query(query, [loaderName]);
    return rows.length > 0 ? rows[0].checksum : null;
}

async function saveChecksum(conn, loaderName, checksum, data) {
    const query = 'INSERT INTO loader_raw_data (loader_name, data_key, raw_json, checksum) VALUES (?, ?, ?, ?)';
    await conn.query(query, [loaderName, new Date().toISOString(), JSON.stringify(data), checksum]);
}

async function fetchEstadoRed() {
    console.log('Fetching estadoRed data...');
    try {
        const response = await axios.get(ESTADO_RED_URL, { timeout: 30000 });
        return response.data;
    } catch (error) {
        console.error('Error fetching estadoRed data:', error);
        return null;
    }
}

async function fetchAccessAriel() {
    console.log('Fetching accessAriel data...');
    try {
        const response = await axios.get(ACCESS_ARIEL_URL, { timeout: 30000 });
        return response.data;
    } catch (error) {
        console.error('Error fetching accessAriel data:', error);
        return null;
    }
}

async function updateAccessDetails(conn, accessArielData) {
    console.log('Updating access details...');

    const accessibilityByStation = {};
    for (const key in accessArielData) {
        const item = accessArielData[key];
        const stationCode = item.estacion.toUpperCase();
        if (!accessibilityByStation[stationCode]) {
            accessibilityByStation[stationCode] = [];
        }
        accessibilityByStation[stationCode].push(item);
    }

    for (const stationCode in accessibilityByStation) {
        const accessDetails = JSON.stringify(accessibilityByStation[stationCode]);
        const query = 'UPDATE metro_stations SET access_details = ? WHERE station_code = ?';
        const result = await conn.query(query, [accessDetails, stationCode]);
        if (result.affectedRows > 0) {
            console.log(`Updated access details for station ${stationCode}`);
        }
    }
    console.log('Access details update complete.');
}

async function updateEstadoRed(conn, estadoRedData) {
    console.log('Updating estadoRed data...');

    const linesData = JSON.parse(await fs.readFile(path.join(__dirname, 'src/data/linesData.json'), 'utf8'));
    const trainInfo = JSON.parse(await fs.readFile(path.join(__dirname, 'src/data/trainInfo.json'), 'utf8'));

    // Update metro_lines
    for (const lineId in estadoRedData) {
        const line = estadoRedData[lineId];
        const lowerLineId = lineId.toLowerCase();
        const fleetData = linesData[lineId] ? JSON.stringify(linesData[lineId].Flota) : null;
        const query = `
            INSERT INTO metro_lines (line_id, line_name, status_message, status_code, fleet_data)
            VALUES (?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
            line_name = VALUES(line_name),
            status_message = VALUES(status_message),
            status_code = VALUES(status_code),
            fleet_data = VALUES(fleet_data)
        `;
        await conn.query(query, [lowerLineId, `Línea ${lowerLineId.substring(1)}`, line.mensaje, line.estado, fleetData]);
        console.log(`Upserted line ${lowerLineId}`);
    }

    // Update metro_stations
    for (const lineId in estadoRedData) {
        const line = estadoRedData[lineId];
        if (line.estaciones) {
            for (const station of line.estaciones) {
                const stationQuery = `
                    INSERT INTO metro_stations (line_id, station_code, station_name, display_name, location)
                    VALUES (?, ?, ?, ?, POINT(0, 0))
                    ON DUPLICATE KEY UPDATE
                    station_name = VALUES(station_name),
                    display_name = VALUES(display_name)
                `;
                await conn.query(stationQuery, [lineId.toLowerCase(), station.codigo.toUpperCase(), station.nombre, station.nombre]);
                console.log(`Upserted station ${station.nombre}`);
            }
        }
    }

    // Update train_models
    for (const modelId in trainInfo.modelos) {
        const modelData = trainInfo.modelos[modelId];
        const query = `
            INSERT INTO train_models (model_id, model_data)
            VALUES (?, ?)
            ON DUPLICATE KEY UPDATE
            model_data = VALUES(model_data)
        `;
        await conn.query(query, [modelId, JSON.stringify(modelData)]);
        console.log(`Upserted train model ${modelId}`);
    }

    // Update line_fleet
    await conn.query('TRUNCATE TABLE line_fleet;');
    for (const lineId in linesData) {
        const line = linesData[lineId];
        if (line.Flota) {
            for (const modelId of line.Flota) {
                const query = `
                    INSERT INTO line_fleet (line_id, model_id, fleet_data)
                    VALUES (?, ?, ?)
                `;
                await conn.query(query, [lineId.toLowerCase(), modelId, '{}']);
                console.log(`Associated fleet ${modelId} with line ${lineId}`);
            }
        }
    }

    console.log('Finished updating estadoRed data.');
}


async function runUpdate() {
    let conn;
    try {
        conn = await pool.getConnection();
        console.log('Connected to the database.');

        const estadoRedData = await fetchEstadoRed();
        if (estadoRedData) {
            const checksum = getChecksum(estadoRedData);
            const lastChecksum = await getLastChecksum(conn, 'estadoRed');
            if (checksum !== lastChecksum) {
                console.log('estadoRed data has changed. Updating database...');
                await updateEstadoRed(conn, estadoRedData);
                await saveChecksum(conn, 'estadoRed', checksum, estadoRedData);
                console.log('estadoRed data update complete.');
            } else {
                console.log('estadoRed data has not changed. No update needed.');
            }
        }

        const accessArielData = await fetchAccessAriel();
        if (accessArielData) {
            const checksum = getChecksum(accessArielData);
            const lastChecksum = await getLastChecksum(conn, 'accessAriel');
            if (checksum !== lastChecksum) {
                console.log('accessAriel data has changed. Updating database...');
                await updateAccessDetails(conn, accessArielData);
                await saveChecksum(conn, 'accessAriel', checksum, accessArielData);
                console.log('accessAriel data update complete.');
            } else {
                console.log('accessAriel data has not changed. No update needed.');
            }
        }

    } catch (err) {
        console.error(err);
    } finally {
        if (conn) conn.release();
    }
}

// Schedule the script to run every 5 minutes
schedule.scheduleJob('*/5 * * * *', () => {
    console.log('Running data update job...');
    runUpdate();
});

console.log('Data loader scheduled to run every 5 minutes.');
runUpdate(); // Run once on startup
