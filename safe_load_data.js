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

async function readDataFiles() {
    const dataDirPath = path.join(__dirname, 'src/data');
    const metroGeneral = JSON.parse(await fs.readFile(path.join(dataDirPath, 'metroGeneral.json'), 'utf8'));
    const intermodalInfo = JSON.parse(await fs.readFile(path.join(dataDirPath, 'intermodalInfo.json'), 'utf8'));
    const intermodalBuses = JSON.parse(await fs.readFile(path.join(dataDirPath, 'intermodalBuses.json'), 'utf8'));
    const linesData = JSON.parse(await fs.readFile(path.join(dataDirPath, 'linesData.json'), 'utf8'));
    const stationsData = JSON.parse(await fs.readFile(path.join(dataDirPath, 'stations.json'), 'utf8'));
    const trainInfo = JSON.parse(await fs.readFile(path.join(dataDirPath, 'trainInfo.json'), 'utf8'));

    return {
        metroGeneral,
        intermodalInfo,
        intermodalBuses,
        linesData,
        stationsData,
        trainInfo
    };
}

async function upsertSystemInfo(conn, data) {
    console.log('Upserting system info...');
    const selectQuery = 'SELECT id FROM system_info LIMIT 1';
    const rows = await conn.query(selectQuery);

    if (rows.length > 0) {
        const id = rows[0].id;
        const updateQuery = `
            UPDATE system_info SET
                name = ?, \`system\` = ?, inauguration = ?, length = ?, stations = ?,
                track_gauge = ?, electrification = ?, max_speed = ?, \`status\` = ?,
                \`lines\` = ?, cars = ?, passengers = ?, fleet = ?, average_speed = ?,
                operator = ?, map_url = ?
            WHERE id = ?
        `;
        await conn.query(updateQuery, [
            data.name, data.system, data.inauguration, data.technicalCharacteristics.length,
            data.technicalCharacteristics.stations, data.technicalCharacteristics.trackGauge,
            data.technicalCharacteristics.electrification, data.technicalCharacteristics.maxSpeed,
            data.operation.status, data.operation.lines, data.operation.cars,
            data.operation.passengers, data.operation.fleet, data.operation.averageSpeed,
            data.operation.operator, data.mapUrl, id
        ]);
        console.log('System info updated.');
    } else {
        const insertQuery = `
            INSERT INTO system_info (name, \`system\`, inauguration, length, stations, track_gauge, electrification, max_speed, \`status\`, \`lines\`, cars, passengers, fleet, average_speed, operator, map_url)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        await conn.query(insertQuery, [
            data.name, data.system, data.inauguration, data.technicalCharacteristics.length,
            data.technicalCharacteristics.stations, data.technicalCharacteristics.trackGauge,
            data.technicalCharacteristics.electrification, data.technicalCharacteristics.maxSpeed,
            data.operation.status, data.operation.lines, data.operation.cars,
            data.operation.passengers, data.operation.fleet, data.operation.averageSpeed,
            data.operation.operator, data.mapUrl
        ]);
        console.log('System info inserted.');
    }
}

async function upsertLines(conn, lines) {
    console.log('Upserting lines...');
    for (const lineId in lines) {
        const line = lines[lineId];
        const query = `
            INSERT INTO metro_lines (line_id, line_name, line_description, opening_date, total_stations, total_length_km)
            VALUES (?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                line_name = VALUES(line_name),
                line_description = VALUES(line_description),
                opening_date = VALUES(opening_date),
                total_stations = VALUES(total_stations),
                total_length_km = VALUES(total_length_km)
        `;
        await conn.query(query, [
            lineId,
            `Línea ${lineId.substring(1)}`,
            line['Características'],
            `${line['Estreno']}-01-01`,
            parseInt(line['N° estaciones']),
            parseFloat(line['Longitud'])
        ]);
    }
    console.log('Lines upserted.');
}

async function upsertStations(conn, stations) {
    console.log('Upserting stations...');
    for (const lineId in stations) {
        const lineStations = stations[lineId];
        for (const stationName in lineStations) {
            const stationCode = stationName.replace(/\s/g, '').toUpperCase().substring(0, 20);
            const query = `
                INSERT INTO metro_stations (line_id, station_code, station_name, display_order, commune, address, latitude, longitude, location)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, POINT(0, 0))
                ON DUPLICATE KEY UPDATE
                    station_name = VALUES(station_name)
            `;
            await conn.query(query, [
                lineId,
                stationCode,
                stationName,
                null, null, null, null, null
            ]);
        }
    }
    console.log('Stations upserted.');
}

async function upsertTrainModels(conn, trainInfo) {
    console.log('Upserting train models...');
    for (const modelId in trainInfo.modelos) {
        const modelData = trainInfo.modelos[modelId];
        const query = `
            INSERT INTO train_models (model_id, model_data)
            VALUES (?, ?)
            ON DUPLICATE KEY UPDATE
                model_data = VALUES(model_data)
        `;
        await conn.query(query, [modelId, JSON.stringify(modelData)]);
    }
    console.log('Train models upserted.');
}

async function upsertLineFleet(conn, linesData) {
    console.log('Upserting line fleet...');
    for (const lineId in linesData) {
        const line = linesData[lineId];
        if (line.Flota) {
            for (const modelId of line.Flota) {
                const selectQuery = 'SELECT id FROM line_fleet WHERE line_id = ? AND model_id = ?';
                const rows = await conn.query(selectQuery, [lineId, modelId]);
                if (rows.length === 0) {
                    const insertQuery = 'INSERT INTO line_fleet (line_id, model_id) VALUES (?, ?)';
                    await conn.query(insertQuery, [lineId, modelId]);
                }
            }
        }
    }
    console.log('Line fleet upserted.');
}

async function upsertIntermodalStations(conn, data) {
    console.log('Upserting intermodal stations...');
    const stationIds = {};
    for (const stationName in data) {
        const station = data[stationName];
        const query = `
            INSERT INTO intermodal_stations (name, services, location, commune, inauguration, platforms, operator)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                services = VALUES(services),
                location = VALUES(location),
                commune = VALUES(commune),
                inauguration = VALUES(inauguration),
                platforms = VALUES(platforms),
                operator = VALUES(operator)
        `;
        const result = await conn.query(query, [
            stationName, JSON.stringify(station.Servicios), station.Ubicación,
            station.Comuna, station.Inauguración, station['N.º de andenes'], station.Operador
        ]);

        if (result.insertId) {
            stationIds[stationName] = result.insertId;
        } else {
            const selectQuery = 'SELECT id FROM intermodal_stations WHERE name = ?';
            const rows = await conn.query(selectQuery, [stationName]);
            if(rows.length > 0) {
                stationIds[stationName] = rows[0].id;
            }
        }
    }
    console.log('Intermodal stations upserted.');
    return stationIds;
}

async function upsertIntermodalBuses(conn, data, stationIds) {
    console.log('Upserting intermodal buses...');
    for (const stationName in data) {
        const buses = data[stationName];
        const stationId = stationIds[stationName];
        if (stationId) {
            for (const bus of buses) {
                const selectQuery = 'SELECT id FROM intermodal_buses WHERE station_id = ? AND type = ? AND route = ? AND destination = ?';
                const rows = await conn.query(selectQuery, [stationId, bus['Tipo Servicio'], bus['Recorrido/Operador'], bus['Destino']]);
                if (rows.length === 0) {
                    const insertQuery = 'INSERT INTO intermodal_buses (station_id, type, route, destination) VALUES (?, ?, ?, ?)';
                    await conn.query(insertQuery, [stationId, bus['Tipo Servicio'], bus['Recorrido/Operador'], bus['Destino']]);
                }
            }
        } else {
            console.warn(`Could not find station ID for ${stationName}`);
        }
    }
    console.log('Intermodal buses upserted.');
}


async function main() {
    let conn;
    try {
        conn = await pool.getConnection();
        console.log('Connected to the database.');

        const data = await readDataFiles();

        await upsertSystemInfo(conn, data.metroGeneral);
        await upsertLines(conn, data.linesData);
        await upsertStations(conn, data.stationsData);
        await upsertTrainModels(conn, data.trainInfo);
        await upsertLineFleet(conn, data.linesData);
        const stationIds = await upsertIntermodalStations(conn, data.intermodalInfo);
        await upsertIntermodalBuses(conn, data.intermodalBuses, stationIds);

        console.log('Safe data loading complete.');

    } catch (err) {
        console.error('Error:', err);
    } finally {
        if (conn) conn.release();
        await pool.end();
    }
}

main();
