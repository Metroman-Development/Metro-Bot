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
            INSERT INTO metro_lines (line_id, line_name, line_description, opening_date, total_stations, total_length_km, fleet_data)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        await conn.query(query, [
            lineId,
            `Línea ${lineId.substring(1)}`,
            line['Características'],
            `${line['Estreno']}-01-01`,
            parseInt(line['N° estaciones']),
            parseFloat(line['Longitud']),
            '[]'
        ]);
        console.log(`Inserted line ${lineId}`);
    }
    console.log('Lines loaded.');
}

async function loadStations(conn, estadoRed, stationsData) {
    console.log('Loading stations...');
    const stationDataMap = new Map(Object.entries(stationsData.stationsData).map(([key, value]) => [key.toLowerCase(), value]));

    for (const lineId in estadoRed) {
        const line = estadoRed[lineId];
        if (line.estaciones) {
            for (const station of line.estaciones) {
                const stationNameKey = station.nombre.toLowerCase();
                const extraData = stationDataMap.get(stationNameKey) || [];
                const query = `
                    INSERT INTO metro_stations (line_id, station_code, station_name, display_order, commune, address, latitude, longitude, location, transports, services, accessibility, commerce, amenities, image_url)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, POINT(0, 0), ?, ?, ?, ?, ?, ?)
                `;
                await conn.query(query, [
                    lineId,
                    station.codigo,
                    station.nombre,
                    null, // display_order
                    extraData[6] || null, // commune
                    null, // address
                    null, // latitude
                    null, // longitude
                    extraData[0] || null, // transports
                    extraData[1] || null, // services
                    extraData[2] || null, // accessibility
                    extraData[3] || null, // commerce
                    extraData[4] || null, // amenities
                    extraData[5] || null  // image_url
                ]);
                console.log(`Inserted station ${station.nombre}`);
            }
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
    await conn.query('TRUNCATE TABLE line_fleet;');
    await conn.query('TRUNCATE TABLE train_models;');
    await conn.query('TRUNCATE TABLE metro_stations;');
    await conn.query('TRUNCATE TABLE metro_lines;');
    await conn.query('SET FOREIGN_KEY_CHECKS = 1;');
    console.log('Tables truncated.');
}

async function loadTrainModels(conn, trainInfo) {
    console.log('Loading train models...');
    for (const modelId in trainInfo.modelos) {
        const modelData = trainInfo.modelos[modelId];
        const query = `
            INSERT INTO train_models (model_id, model_data)
            VALUES (?, ?)
        `;
        await conn.query(query, [
            modelId,
            JSON.stringify(modelData)
        ]);
        console.log(`Inserted train model ${modelId}`);
    }
    console.log('Train models loaded.');
}

async function loadLineFleet(conn, linesData) {
    console.log('Loading line fleet...');
    for (const lineId in linesData) {
        const line = linesData[lineId];
        if (line.Flota) {
            for (const modelId of line.Flota) {
                const query = `
                    INSERT INTO line_fleet (line_id, model_id, fleet_data)
                    VALUES (?, ?, ?)
                `;
                await conn.query(query, [lineId, modelId, '{}']);
                console.log(`Associated fleet ${modelId} with line ${lineId}`);
            }
        }
    }
    console.log('Line fleet loaded.');
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

        const estadoRed = JSON.parse(await fs.readFile(path.join(__dirname, 'src/data/estadoRed.json'), 'utf8'));
        const stationsData = JSON.parse(await fs.readFile(path.join(__dirname, 'src/data/stationsData.json'), 'utf8'));
        await loadStations(conn, estadoRed, stationsData);

        const trainInfo = JSON.parse(await fs.readFile(path.join(__dirname, 'src/data/trainInfo.json'), 'utf8'));
        await loadTrainModels(conn, trainInfo);

        await loadLineFleet(conn, linesData);

    } catch (err) {
        console.error(err);
    } finally {
        if (conn) conn.release();
        pool.end();
    }
}

main();
