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

async function loadLines(conn, lines) {
    console.log('Loading lines...');
    for (const lineId in lines) {
        const line = lines[lineId];
        const query = `
            INSERT INTO metro_lines (line_id, line_name, line_description, opening_date, total_stations, total_length_km)
            VALUES (?, ?, ?, ?, ?, ?)
        `;
        await conn.query(query, [
            lineId,
            `Línea ${lineId.substring(1)}`,
            line['Características'],
            `${line['Estreno']}-01-01`,
            parseInt(line['N° estaciones']),
            parseFloat(line['Longitud'])
        ]);
        console.log(`Inserted line ${lineId}`);
    }
    console.log('Lines loaded.');
}

async function loadStations(conn, stations) {
    console.log('Loading stations...');
    for (const lineId in stations) {
        const lineStations = stations[lineId];
        for (const stationName in lineStations) {
            const station = lineStations[stationName];
            const query = `
                INSERT INTO metro_stations (line_id, station_code, station_name, display_order, commune, address, latitude, longitude, location)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, POINT(0, 0))
            `;
            // A station code can be generated from the station name by removing spaces and making it lowercase
            const stationCode = stationName.replace(/\s/g, '').toLowerCase();
            await conn.query(query, [
                lineId,
                stationCode,
                stationName,
                null, // display_order
                null, // commune
                null, // address
                null, // latitude
                null, // longitude
            ]);
            console.log(`Inserted station ${stationName}`);
        }
    }
    console.log('Stations loaded.');
}

async function loadSystemInfo(conn, data) {
    console.log('Loading system info...');
    const query = `
        INSERT INTO system_info (name, \`system\`, inauguration, length, stations, track_gauge, electrification, max_speed, \`status\`, \`lines\`, cars, passengers, fleet, average_speed, operator, map_url)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    await conn.query(query, [
        data.name,
        data.system,
        data.inauguration,
        data.technicalCharacteristics.length,
        data.technicalCharacteristics.stations,
        data.technicalCharacteristics.trackGauge,
        data.technicalCharacteristics.electrification,
        data.technicalCharacteristics.maxSpeed,
        data.operation.status,
        data.operation.lines,
        data.operation.cars,
        data.operation.passengers,
        data.operation.fleet,
        data.operation.averageSpeed,
        data.operation.operator,
        data.mapUrl
    ]);
    console.log('System info loaded.');
}

async function loadIntermodalStations(conn, data) {
    console.log('Loading intermodal stations...');
    const stationIds = {};
    for (const stationName in data) {
        const station = data[stationName];
        const query = `
            INSERT INTO intermodal_stations (name, services, location, commune, inauguration, platforms, operator)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        const result = await conn.query(query, [
            stationName,
            JSON.stringify(station.Servicios),
            station.Ubicación,
            station.Comuna,
            station.Inauguración,
            station['N.º de andenes'],
            station.Operador
        ]);
        stationIds[stationName] = result.insertId;
        console.log(`Inserted intermodal station ${stationName}`);
    }
    console.log('Intermodal stations loaded.');
    return stationIds;
}

async function loadIntermodalBuses(conn, data, stationIds) {
    console.log('Loading intermodal buses...');
    for (const stationName in data) {
        const buses = data[stationName];
        const stationId = stationIds[stationName];
        if (stationId) {
            for (const bus of buses) {
                const query = `
                    INSERT INTO intermodal_buses (station_id, type, route, destination)
                    VALUES (?, ?, ?, ?)
                `;
                await conn.query(query, [
                    stationId,
                    bus['Tipo Servicio'],
                    bus['Recorrido/Operador'],
                    bus['Destino']
                ]);
            }
            console.log(`Inserted buses for ${stationName}`);
        } else {
            console.warn(`Could not find station ID for ${stationName}`);
        }
    }
    console.log('Intermodal buses loaded.');
}

async function truncateTables(conn) {
    console.log('Truncating tables...');
    await conn.query('SET FOREIGN_KEY_CHECKS = 0;');
    await conn.query('TRUNCATE TABLE system_info;');
    await conn.query('TRUNCATE TABLE intermodal_buses;');
    await conn.query('TRUNCATE TABLE intermodal_stations;');
    await conn.query('TRUNCATE TABLE metro_stations;');
    await conn.query('TRUNCATE TABLE metro_lines;');
    await conn.query('SET FOREIGN_KEY_CHECKS = 1;');
    console.log('Tables truncated.');
}

async function main() {
    let conn;
    try {
        conn = await pool.getConnection();
        console.log('Connected to the database.');

        await truncateTables(conn);

        const metroGeneral = JSON.parse(await fs.readFile(path.join(__dirname, 'src/data/metroGeneral.json'), 'utf8'));
        await loadSystemInfo(conn, metroGeneral);

        const intermodalInfo = JSON.parse(await fs.readFile(path.join(__dirname, 'src/data/intermodalInfo.json'), 'utf8'));
        const stationIds = await loadIntermodalStations(conn, intermodalInfo);

        const intermodalBuses = JSON.parse(await fs.readFile(path.join(__dirname, 'src/data/intermodalBuses.json'), 'utf8'));
        await loadIntermodalBuses(conn, intermodalBuses, stationIds);

        const linesData = JSON.parse(await fs.readFile(path.join(__dirname, 'src/data/linesData.json'), 'utf8'));
        await loadLines(conn, linesData);

        const stationsData = JSON.parse(await fs.readFile(path.join(__dirname, 'src/data/stations.json'), 'utf8'));
        await loadStations(conn, stationsData);

    } catch (err) {
        console.error(err);
    } finally {
        if (conn) conn.release();
        pool.end();
    }
}

main();
