require('dotenv').config();
const logger = require('./src/events/logger.js');
const mariadb = require('mariadb');
const fs = require('fs').promises;
const path = require('path');
const normalizer = require('./src/core/metro/utils/stringHandlers/normalization');

const pool = mariadb.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.METRODB_NAME,
    connectionLimit: 5
});

function calculateTerminalStations(line, allStations) {
    const lineStations = allStations.filter(s => s.line_id.toLowerCase() === line.id.toLowerCase());
    if (lineStations.length === 0) {
        return { platform1: null, platform2: null };
    }

    // Assuming lineStations are ordered by their position on the line
    const firstStation = lineStations[0];
    const lastStation = lineStations[lineStations.length - 1];

    if (line.estado === '10') { // 10 is 'operativa'
        return {
            platform1: { terminal: firstStation.nombre, status: 'operational' },
            platform2: { terminal: lastStation.nombre, status: 'operational' }
        };
    } else {
        // This is a simplified logic. A more complex implementation would be needed to handle all partial service scenarios.
        // For now, we'll just return the first and last stations of the line, even if it's in partial service.
        return {
            platform1: { terminal: firstStation.nombre, status: 'operational' },
            platform2: { terminal: lastStation.nombre, status: 'operational' }
        };
    }
}

async function loadLines(conn, lines, allStations) {
    logger.detailed('Processing lines data for insertion', lines);
    console.log('Upserting lines...');
    for (const lineId in lines) {
        const line = lines[lineId];
        const lowerLineId = lineId.toLowerCase();
        const platformDetails = calculateTerminalStations({ id: lowerLineId, ...line }, allStations);
        const expressStatus = line.express ? 'active' : 'inactive';

        const query = `
            INSERT INTO metro_lines (line_id, line_name, line_description, opening_date, total_stations, total_length_km, fleet_data, platform_details, express_status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                line_name = VALUES(line_name),
                line_description = VALUES(line_description),
                opening_date = VALUES(opening_date),
                total_stations = VALUES(total_stations),
                total_length_km = VALUES(total_length_km),
                fleet_data = VALUES(fleet_data),
                platform_details = VALUES(platform_details),
                express_status = VALUES(express_status)
        `;
        await conn.query(query, [
            lowerLineId,
            `Línea ${lowerLineId.substring(1)}`,
            line['Características'],
            `${line['Estreno']}-01-01`,
            parseInt(line['N° estaciones']),
            parseFloat(line['Longitud']),
            '[]',
            JSON.stringify(platformDetails),
            expressStatus
        ]);
        console.log(`Upserted line ${lineId}`);
    }
    console.log('Lines upserted.');
}

async function loadStations(conn, estadoRed, stationsData, stations) {
    logger.detailed('Processing stations data for insertion', { estadoRed, stationsData });
    console.log('Upserting stations...');
    const stationDataMap = new Map(Object.entries(stationsData.stationsData).map(([key, value]) => [normalizer.normalize(key), value]));

    // Flatten all stations from estadoRed into a single list to control the insertion order and ID assignment.
    const allStations = [];
    const lineOrder = ['L1', 'L2', 'L3', 'L4', 'L4A', 'L5', 'L6']; // Explicitly define line order
    for (const lineId of lineOrder) {
        const lowerLineId = lineId.toLowerCase();
        if (estadoRed[lowerLineId] && estadoRed[lowerLineId].estaciones) {
            estadoRed[lowerLineId].estaciones.forEach(station => {
                allStations.push({ ...station, line_id: lineId });
            });
        }
    }

    let stationIdCounter = 1;
    for (const station of allStations) {
        const stationNameKey = normalizer.normalize(station.nombre);
        const extraData = stationDataMap.get(stationNameKey) || [];
        const connections = station.combinacion ? station.combinacion.split(',').map(c => c.trim().toLowerCase()) : [];
        console.log(`Station: ${station.nombre}, Connections: ${JSON.stringify(connections)}`);
        const platformsQuery = 'SELECT via_number, status FROM line_platforms WHERE line_id = ?';
        const platformRows = await conn.query(platformsQuery, [station.line_id.toLowerCase()]);

        const platforms = {};
        for (const row of platformRows) {
            platforms[row.via_number] = row.status;
        }

        const stationInfo = stations[station.line_id.toLowerCase()] && stations[station.line_id.toLowerCase()][station.nombre];
        let routeColor = 'N'; // Default to 'N'
        if (stationInfo && stationInfo.ruta) {
            if (stationInfo.ruta.includes('Roja')) {
                routeColor = 'R';
            } else if (stationInfo.ruta.includes('Verde')) {
                routeColor = 'V';
            } else if (stationInfo.ruta.includes('Común')) {
                routeColor = 'C';
            }
        }
        const expressState = stationInfo && stationInfo.ruta ? 'Operational' : 'Non operational';

        const query = `
            INSERT INTO metro_stations (station_id, line_id, station_code, station_name, display_order, commune, address, latitude, longitude, location, transports, services, accessibility, commerce, amenities, image_url, combinacion, display_name, access_details, opened_date, last_renovation_date, connections, platforms, express_state, route_color)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, POINT(0, 0), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                station_name = VALUES(station_name),
                display_order = VALUES(display_order),
                commune = VALUES(commune),
                address = VALUES(address),
                latitude = VALUES(latitude),
                longitude = VALUES(longitude),
                location = VALUES(location),
                transports = VALUES(transports),
                services = VALUES(services),
                accessibility = VALUES(accessibility),
                commerce = VALUES(commerce),
                amenities = VALUES(amenities),
                image_url = VALUES(image_url),
                combinacion = VALUES(combinacion),
                display_name = VALUES(display_name),
                access_details = VALUES(access_details),
                opened_date = VALUES(opened_date),
                last_renovation_date = VALUES(last_renovation_date),
                express_state = VALUES(express_state),
                route_color = VALUES(route_color)
        `;
        await conn.query(query, [
            stationIdCounter,
            station.line_id.toLowerCase(),
            station.codigo.toUpperCase(),
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
            extraData[5] || null, // image_url
            null, // combinacion
            station.nombre, // display_name
            null, // access_details
            null, // opened_date
            null, // last_renovation_date
            JSON.stringify(connections),
            JSON.stringify(platforms),
            expressState,
            routeColor
        ]);
        console.log(`Upserted station ${station.nombre} with ID ${stationIdCounter}`);
        stationIdCounter++;
    }
    console.log('Stations upserted.');
}

async function loadSystemInfo(conn, data) {
    logger.detailed('Processing system info data for insertion', data);
    console.log('Upserting system info...');
    const query = `
        INSERT INTO system_info (id, name, \`system\`, inauguration, length, stations, track_gauge, electrification, max_speed, \`status\`, \`lines\`, cars, passengers, fleet, average_speed, operator, map_url)
        VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            name = VALUES(name), \`system\` = VALUES(\`system\`), inauguration = VALUES(inauguration), length = VALUES(length), stations = VALUES(stations),
            track_gauge = VALUES(track_gauge), electrification = VALUES(electrification), max_speed = VALUES(max_speed), \`status\` = VALUES(\`status\`),
            \`lines\` = VALUES(\`lines\`), cars = VALUES(cars), passengers = VALUES(passengers), fleet = VALUES(fleet), average_speed = VALUES(average_speed),
            operator = VALUES(operator), map_url = VALUES(map_url)
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
    console.log('System info upserted.');
}

async function loadIntermodalStations(conn, data) {
    logger.detailed('Processing intermodal stations data for insertion', data);
    console.log('Loading intermodal stations...');
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
            stationName,
            JSON.stringify(station.Servicios),
            station.Ubicación,
            station.Comuna,
            station.Inauguración,
            station['N.º de andenes'],
            station.Operador
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
        console.log(`Upserted intermodal station ${stationName}`);
    }
    console.log('Intermodal stations loaded.');
    return stationIds;
}

async function loadIntermodalBuses(conn, data, stationIds) {
    logger.detailed('Processing intermodal buses data for insertion', data);
    console.log('Upserting intermodal buses...');
    for (const stationName in data) {
        const buses = data[stationName];
        const stationId = stationIds[stationName];
        if (stationId) {
            for (const bus of buses) {
                const query = `
                    INSERT INTO intermodal_buses (station_id, type, route, destination)
                    VALUES (?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE
                        type = VALUES(type),
                        route = VALUES(route),
                        destination = VALUES(destination)
                `;
                await conn.query(query, [
                    stationId,
                    bus['Tipo Servicio'],
                    bus['Recorrido/Operador'],
                    bus['Destino']
                ]);
            }
            console.log(`Upserted buses for ${stationName}`);
        } else {
            console.warn(`Could not find station ID for ${stationName}`);
        }
    }
    console.log('Intermodal buses upserted.');
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
    await conn.query('TRUNCATE TABLE line_platforms;');
    await conn.query('SET FOREIGN_KEY_CHECKS = 1;');
    console.log('Tables truncated.');
}

async function loadTrainModels(conn, trainInfo, trainImages) {
    logger.detailed('Processing train models data for insertion', trainInfo);
    console.log('Upserting train models...');
    for (const modelId in trainInfo.modelos) {
        const modelData = trainInfo.modelos[modelId];
        const imageUrl = trainImages[modelId] ? trainImages[modelId].exterior : null;

        const datosGenerales = modelData.datos_generales || {};
        const caracteristicas = modelData.caracteristicas_tecnicas || {};
        const dimensiones = caracteristicas.dimensiones || {};
        const peso = caracteristicas.peso || {};
        const motores = caracteristicas.motores_electricos || {};

        const totalProduced = datosGenerales.unidades_fabricadas ? datosGenerales.unidades_fabricadas.trenes : null;
        const inServiceCount = datosGenerales.unidades_fabricadas && datosGenerales.unidades_fabricadas.en_servicio ? datosGenerales.unidades_fabricadas.en_servicio.trenes : null;

        let length = null;
        if (typeof dimensiones.longitud === 'string') {
            length = parseFloat(dimensiones.longitud.replace(' m', ''));
        } else if (typeof dimensiones.longitud === 'object' && dimensiones.longitud !== null) {
            length = parseFloat(Object.values(dimensiones.longitud)[0].replace(' m', ''));
        }

        let weight = null;
        if (typeof peso === 'string') {
            weight = parseFloat(peso.replace(' t', ''));
        } else if (typeof peso === 'object' && peso !== null) {
            // It seems weight is not always an object with a clear value, so we'll handle it carefully.
            const firstValue = Object.values(peso)[0];
            if (typeof firstValue === 'string') {
                weight = parseFloat(firstValue.replace(' t', ''));
            }
        }

        const query = `
            INSERT INTO train_models (
                model_id, model_name, manufacturer, image_url, construction_years,
                in_service_years, total_produced, in_service_count, formation,
                length_m, width_m, height_m, weight_ton, max_speed_kmh,
                traction_system, power_supply
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                model_name = VALUES(model_name),
                manufacturer = VALUES(manufacturer),
                image_url = VALUES(image_url),
                construction_years = VALUES(construction_years),
                in_service_years = VALUES(in_service_years),
                total_produced = VALUES(total_produced),
                in_service_count = VALUES(in_service_count),
                formation = VALUES(formation),
                length_m = VALUES(length_m),
                width_m = VALUES(width_m),
                height_m = VALUES(height_m),
                weight_ton = VALUES(weight_ton),
                max_speed_kmh = VALUES(max_speed_kmh),
                traction_system = VALUES(traction_system),
                power_supply = VALUES(power_supply)
        `;

        await conn.query(query, [
            modelId,
            modelId, // model_name
            datosGenerales.fabricante,
            imageUrl,
            datosGenerales.año_fabricacion,
            datosGenerales.año_fabricacion, // in_service_years
            totalProduced,
            inServiceCount,
            Array.isArray(caracteristicas.composicion) ? caracteristicas.composicion.join('; ') : caracteristicas.composicion,
            length,
            dimensiones.anchura ? parseFloat(dimensiones.anchura.replace(' m', '')) : null,
            dimensiones.altura ? parseFloat(dimensiones.altura.replace(' m (sin pantógrafo)','').replace(' m','')) : null,
            weight,
            caracteristicas.velocidad_maxima ? parseInt(caracteristicas.velocidad_maxima.replace(' km/h', '')) : null,
            motores.tipo,
            motores.alimentacion
        ]);
        console.log(`Upserted train model ${modelId}`);
    }
    console.log('Train models upserted.');
}

async function loadLineFleet(conn, linesData) {
    logger.detailed('Processing line fleet data for insertion', linesData);
    console.log('Upserting line fleet...');
    for (const lineId in linesData) {
        const line = linesData[lineId];
        if (line.Flota) {
            for (const modelId of line.Flota) {
                const query = `
                    INSERT INTO line_fleet (line_id, model_id)
                    VALUES (?, ?)
                    ON DUPLICATE KEY UPDATE
                        model_id = VALUES(model_id)
                `;
                await conn.query(query, [lineId.toLowerCase(), modelId]);
                console.log(`Upserted fleet ${modelId} with line ${lineId}`);
            }
        }
    }
    console.log('Line fleet upserted.');
}

async function loadAccessibilityStatus(conn, accessibilityData) {
    logger.detailed('Processing accessibility status data for insertion', accessibilityData);
    console.log('Upserting accessibility status...');
    for (const equipmentId in accessibilityData) {
        const item = accessibilityData[equipmentId];
        const query = `
            INSERT INTO accessibility_status (equipment_id, station_code, line_id, status, type, text, last_updated)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                station_code = VALUES(station_code),
                line_id = VALUES(line_id),
                status = VALUES(status),
                type = VALUES(type),
                text = VALUES(text),
                last_updated = VALUES(last_updated)
        `;
        await conn.query(query, [
            equipmentId,
            item.estacion,
            item.linea || '', // Assuming linea can be missing
            item.estado,
            item.tipo,
            item.texto,
            new Date(item.time)
        ]);
        console.log(`Upserted accessibility status for ${equipmentId}`);
    }
    console.log('Accessibility status upserted.');
}

async function loadFutureLines(conn, futureLinesData) {
    logger.detailed('Processing future lines data for insertion', futureLinesData);
    console.log('Upserting future lines...');
    for (const lineId in futureLinesData) {
        const line = futureLinesData[lineId];
        const query = `
            INSERT INTO future_lines (line_id, communes, inauguration_year, length_km, stations_count, electrification, characteristics, fleet, color, interconnections)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                communes = VALUES(communes),
                inauguration_year = VALUES(inauguration_year),
                length_km = VALUES(length_km),
                stations_count = VALUES(stations_count),
                electrification = VALUES(electrification),
                characteristics = VALUES(characteristics),
                fleet = VALUES(fleet),
                color = VALUES(color),
                interconnections = VALUES(interconnections)
        `;
        await conn.query(query, [
            lineId,
            line.Comunas.join(', '),
            parseInt(line.Estreno.match(/\d{4}/)[0]),
            parseFloat(line.Longitud),
            parseInt(line['N° estaciones']),
            line.Electrificación,
            line.Características,
            line.Flota.join(', '),
            line.Color,
            JSON.stringify(line.Interconexiones)
        ]);
        console.log(`Upserted future line ${lineId}`);
    }
    console.log('Future lines upserted.');
}

async function main() {
    let conn;
    try {
        conn = await pool.getConnection();
        console.log('Connected to the database.');

        await truncateTables(conn);

        const seedLinePlatformsSql = await fs.readFile(path.join(__dirname, 'seed_line_platforms.sql'), 'utf8');
        await conn.query(seedLinePlatformsSql);
        console.log('Seeded line_platforms table.');

        const metroGeneral = JSON.parse(await fs.readFile(path.join(__dirname, 'src/data/metroGeneral.json'), 'utf8'));
        logger.detailed('Loaded metroGeneral.json', metroGeneral);
        await loadSystemInfo(conn, metroGeneral);

        const intermodalInfo = JSON.parse(await fs.readFile(path.join(__dirname, 'src/data/intermodalInfo.json'), 'utf8'));
        logger.detailed('Loaded intermodalInfo.json', intermodalInfo);
        const stationIds = await loadIntermodalStations(conn, intermodalInfo);

        const intermodalBuses = JSON.parse(await fs.readFile(path.join(__dirname, 'src/data/intermodalBuses.json'), 'utf8'));
        logger.detailed('Loaded intermodalBuses.json', intermodalBuses);
        await loadIntermodalBuses(conn, intermodalBuses, stationIds);

        const linesData = JSON.parse(await fs.readFile(path.join(__dirname, 'src/data/linesData.json'), 'utf8'));
        logger.detailed('Loaded linesData.json', linesData);
        const estadoRed = JSON.parse(await fs.readFile(path.join(__dirname, 'src/data/estadoRed.json'), 'utf8'));
        const allStations = [];
        const lineOrder = ['L1', 'L2', 'L3', 'L4', 'L4A', 'L5', 'L6']; // Explicitly define line order
        for (const lineId of lineOrder) {
            const lowerLineId = lineId.toLowerCase();
            if (estadoRed[lowerLineId] && estadoRed[lowerLineId].estaciones) {
                estadoRed[lowerLineId].estaciones.forEach(station => {
                    allStations.push({ ...station, line_id: lineId });
                });
            }
        }
        await loadLines(conn, linesData, allStations);
        logger.detailed('Loaded estadoRed.json', estadoRed);
        const stationsData = JSON.parse(await fs.readFile(path.join(__dirname, 'src/data/stationsData.json'), 'utf8'));
        logger.detailed('Loaded stationsData.json', stationsData);
        const stations = JSON.parse(await fs.readFile(path.join(__dirname, 'src/data/stations.json'), 'utf8'));
        logger.detailed('Loaded stations.json', stations);
        await loadStations(conn, estadoRed, stationsData, stations);

        const trainInfo = JSON.parse(await fs.readFile(path.join(__dirname, 'src/data/trainInfo.json'), 'utf8'));
        logger.detailed('Loaded trainInfo.json', trainInfo);
        const trainImages = JSON.parse(await fs.readFile(path.join(__dirname, 'src/data/trainImages.json'), 'utf8'));
        logger.detailed('Loaded trainImages.json', trainImages);
        await loadTrainModels(conn, trainInfo, trainImages);

        await loadLineFleet(conn, linesData);

        const accessibilityCache = JSON.parse(await fs.readFile(path.join(__dirname, 'src/data/accessibilityCache.json'), 'utf8'));
        logger.detailed('Loaded accessibilityCache.json', accessibilityCache);
        await loadAccessibilityStatus(conn, accessibilityCache);

        const lineasproyectoMetro = JSON.parse(await fs.readFile(path.join(__dirname, 'src/data/lineasproyectoMetro.json'), 'utf8'));
        logger.detailed('Loaded lineasproyectoMetro.json', lineasproyectoMetro);
        await loadFutureLines(conn, lineasproyectoMetro);

    } catch (err) {
        console.error(err);
    } finally {
        if (conn) conn.release();
        pool.end();
    }
}

main();
