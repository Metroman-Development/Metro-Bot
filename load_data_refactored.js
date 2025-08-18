require('dotenv').config();
const path = require('path');
const schedule = require('node-schedule');
const MetroCore = require('./src/core/metro/core/MetroCore');

/**
 * Updates the database with the provided station data.
 * @param {object} station - The station object from Metrocore.
 * @param {object} dbService - The database service instance from Metrocore.
 */
async function updateStationInDb(station, dbService) {
    // 1. Validate data
    if (!station.commune || !station.status) {
        console.warn(`[Data Loader] Skipping station ${station.station_code} due to missing 'commune' or 'status' data.`);
        return;
    }

    // 2. Update metro_stations table
    const stationQuery = `
        INSERT INTO metro_stations (
            line_id, station_code, station_name, display_name, display_order,
            commune, address, latitude, longitude, location,
            transports, services, accessibility, commerce, amenities, image_url, access_details
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, POINT(?, ?), ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            station_name = VALUES(station_name),
            display_name = VALUES(display_name),
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
            access_details = VALUES(access_details)
    `;

    // Ensure longitude and latitude are valid numbers, otherwise default to 0 for POINT
    const longitude = parseFloat(station.longitude);
    const latitude = parseFloat(station.latitude);
    const validPoint = !isNaN(longitude) && !isNaN(latitude);

    await dbService.db.query(stationQuery, [
        station.line_id, station.station_code, station.station_name, station.display_name || station.station_name, station.display_order || null,
        station.commune, station.address || null, station.latitude || null, station.longitude || null,
        validPoint ? longitude : 0, validPoint ? latitude : 0,
        station.transports || null, station.services || null, station.accessibility || null, station.commerce || null, station.amenities || null, station.image_url || null,
        station.access_details ? JSON.stringify(station.access_details) : null
    ]);
    console.log(`[Data Loader] Upserted station ${station.station_name}`);

    // 3. Update station_status table
    if (station.status && station.status.code) {
        await dbService.updateStationStatus(
            station.station_code,
            station.line_id,
            station.status.code,
            station.status.description,
            station.status.message
        );
        console.log(`[Data Loader] Updated status for station ${station.station_name}`);
    }

    // 4. Update accessibility_status table
    if (station.access_details && Array.isArray(station.access_details)) {
        for (const item of station.access_details) {
            await dbService.updateAccessibilityStatus(
                item.equipment_id,
                item.station_code,
                item.line_id,
                item.status,
                item.type,
                item.text
            );
        }
        console.log(`[Data Loader] Updated accessibility for station ${station.station_name}`);
    }
}


async function updateIncidentsInDb(data, dbService) {
    if (data.incidents && Array.isArray(data.incidents)) {
        for (const incident of data.incidents) {
            const query = `
                INSERT INTO incidents (incident_id, incident_type_id, station_id, line_id, description, severity_level, status, photo_url, reported_by, resolved_at, resolved_by)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    incident_type_id = VALUES(incident_type_id),
                    station_id = VALUES(station_id),
                    line_id = VALUES(line_id),
                    description = VALUES(description),
                    severity_level = VALUES(severity_level),
                    status = VALUES(status),
                    photo_url = VALUES(photo_url),
                    reported_by = VALUES(reported_by),
                    resolved_at = VALUES(resolved_at),
                    resolved_by = VALUES(resolved_by)
            `;
            await dbService.db.query(query, [
                incident.incident_id, incident.incident_type_id, incident.station_id, incident.line_id, incident.description,
                incident.severity_level, incident.status, incident.photo_url, incident.reported_by, incident.resolved_at, incident.resolved_by
            ]);
        }
        console.log('[Data Loader] Upserted incidents.');
    }
}

async function updateSystemInfoInDb(data, dbService) {
    if (data.systemInfo) {
        const info = data.systemInfo;
        const query = `
            INSERT INTO system_info (id, name, system, inauguration, length, stations, track_gauge, electrification, max_speed, status, lines, cars, passengers, fleet, average_speed, operator, map_url, events)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                name = VALUES(name), system = VALUES(system), inauguration = VALUES(inauguration), length = VALUES(length), stations = VALUES(stations),
                track_gauge = VALUES(track_gauge), electrification = VALUES(electrification), max_speed = VALUES(max_speed), status = VALUES(status),
                lines = VALUES(lines), cars = VALUES(cars), passengers = VALUES(passengers), fleet = VALUES(fleet), average_speed = VALUES(average_speed),
                operator = VALUES(operator), map_url = VALUES(map_url), events = VALUES(events)
        `;
        await dbService.db.query(query, [
            info.id, info.name, info.system, info.inauguration, info.length, info.stations, info.track_gauge, info.electrification,
            info.max_speed, info.status, info.lines, info.cars, info.passengers, info.fleet, info.average_speed, info.operator,
            info.map_url, JSON.stringify(info.events)
        ]);
        console.log('[Data Loader] Upserted system info.');
    }
}

async function updateTrainModelsInDb(data, dbService) {
    if (data.trainModels && Array.isArray(data.trainModels)) {
        for (const model of data.trainModels) {
            const query = `
                INSERT INTO train_models (model_id, model_data)
                VALUES (?, ?)
                ON DUPLICATE KEY UPDATE model_data = VALUES(model_data)
            `;
            await dbService.db.query(query, [model.model_id, JSON.stringify(model.model_data)]);
        }
        console.log('[Data Loader] Upserted train models.');
    }
}

async function updateLineFleetInDb(data, dbService) {
    if (data.lineFleet && Array.isArray(data.lineFleet)) {
        for (const fleet of data.lineFleet) {
            const query = `
                INSERT INTO line_fleet (id, line_id, model_id)
                VALUES (?, ?, ?)
                ON DUPLICATE KEY UPDATE line_id = VALUES(line_id), model_id = VALUES(model_id)
            `;
            await dbService.db.query(query, [fleet.id, fleet.line_id, fleet.model_id]);
        }
        console.log('[Data Loader] Upserted line fleet.');
    }
}

async function updateStatusOverridesInDb(data, dbService) {
    if (data.statusOverrides && Array.isArray(data.statusOverrides)) {
        for (const override of data.statusOverrides) {
            const query = `
                INSERT INTO status_overrides (id, target_type, target_id, status, message, source, expires_at, is_active)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    target_type = VALUES(target_type), target_id = VALUES(target_id), status = VALUES(status), message = VALUES(message),
                    source = VALUES(source), expires_at = VALUES(expires_at), is_active = VALUES(is_active)
            `;
            await dbService.db.query(query, [
                override.id, override.target_type, override.target_id, override.status, override.message,
                override.source, override.expires_at, override.is_active
            ]);
        }
        console.log('[Data Loader] Upserted status overrides.');
    }
}

async function updateScheduledStatusOverridesInDb(data, dbService) {
    if (data.scheduledStatusOverrides && Array.isArray(data.scheduledStatusOverrides)) {
        for (const override of data.scheduledStatusOverrides) {
            const query = `
                INSERT INTO scheduled_status_overrides (id, target_type, target_id, status, message, source, type, start_at, end_at, is_active)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    target_type = VALUES(target_type), target_id = VALUES(target_id), status = VALUES(status), message = VALUES(message),
                    source = VALUES(source), type = VALUES(type), start_at = VALUES(start_at), end_at = VALUES(end_at), is_active = VALUES(is_active)
            `;
            await dbService.db.query(query, [
                override.id, override.target_type, override.target_id, override.status, override.message,
                override.source, override.type, override.start_at, override.end_at, override.is_active
            ]);
        }
        console.log('[Data Loader] Upserted scheduled status overrides.');
    }
}

async function updateIntermodalStationsInDb(data, dbService) {
    if (data.intermodalStations && Array.isArray(data.intermodalStations)) {
        for (const station of data.intermodalStations) {
            const query = `
                INSERT INTO intermodal_stations (id, name, services, location, commune, inauguration, platforms, operator)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    name = VALUES(name), services = VALUES(services), location = VALUES(location), commune = VALUES(commune),
                    inauguration = VALUES(inauguration), platforms = VALUES(platforms), operator = VALUES(operator)
            `;
            await dbService.db.query(query, [
                station.id, station.name, station.services, station.location, station.commune,
                station.inauguration, station.platforms, station.operator
            ]);
        }
        console.log('[Data Loader] Upserted intermodal stations.');
    }
}

async function updateIntermodalBusesInDb(data, dbService) {
    if (data.intermodalBuses && Array.isArray(data.intermodalBuses)) {
        for (const bus of data.intermodalBuses) {
            const query = `
                INSERT INTO intermodal_buses (id, station_id, type, route, destination)
                VALUES (?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    station_id = VALUES(station_id), type = VALUES(type), route = VALUES(route), destination = VALUES(destination)
            `;
            await dbService.db.query(query, [bus.id, bus.station_id, bus.type, bus.route, bus.destination]);
        }
        console.log('[Data Loader] Upserted intermodal buses.');
    }
}

async function updateNetworkStatusInDb(data, dbService) {
    if (data.networkStatus) {
        const status = data.networkStatus;
        const query = `
            INSERT INTO network_status (id, network_status_summary, fare_period, active_event)
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                network_status_summary = VALUES(network_status_summary), fare_period = VALUES(fare_period), active_event = VALUES(active_event)
        `;
        await dbService.db.query(query, [
            status.id, JSON.stringify(status.network_status_summary), status.fare_period, JSON.stringify(status.active_event)
        ]);
        console.log('[Data Loader] Upserted network status.');
    }
}

async function runUpdate() {
    console.log('[Data Loader] Running data update job...');
    try {
        console.log('[Data Loader] Getting Metrocore instance...');
        const metro = await MetroCore.getInstance();
        const dbService = metro._subsystems.dbService;

        console.log('[Data Loader] Metrocore instance obtained. Waiting for 30 seconds...');
        await new Promise(resolve => setTimeout(resolve, 30000));

        let data;
        for (let i = 0; i < 3; i++) {
            console.log(`[Data Loader] Getting current data from Metrocore (Attempt ${i + 1})...`);
            data = await metro.getCurrentData();
            if (data && data.lines && Object.keys(data.lines).length > 0) {
                console.log('[Data Loader] Data received successfully.');
                break;
            }
            console.log('[Data Loader] Incomplete data received. Retrying in 10 seconds...');
            await new Promise(resolve => setTimeout(resolve, 10000));
            data = null; // Reset data to ensure loop condition is checked correctly
        }

        if (data) {
            console.log('[Data Loader] Starting database update process...');
            for (const lineId in data.lines) {
                const line = data.lines[lineId];
                if (line.stations && Array.isArray(line.stations)) {
                    for (const station of line.stations) {
                        await updateStationInDb(station, dbService);
                    }
                }
            }

            await updateIncidentsInDb(data, dbService);
            await updateSystemInfoInDb(data, dbService);
            await updateTrainModelsInDb(data, dbService);
            await updateLineFleetInDb(data, dbService);
            await updateStatusOverridesInDb(data, dbService);
            await updateScheduledStatusOverridesInDb(data, dbService);
            await updateIntermodalStationsInDb(data, dbService);
            await updateIntermodalBusesInDb(data, dbService);
            await updateNetworkStatusInDb(data, dbService);

            console.log('[Data Loader] Database update process complete.');
        } else {
            console.error('[Data Loader] Failed to get complete data from Metrocore after multiple retries.');
        }

    } catch (err) {
        console.error('[Data Loader] An error occurred during the update process:', err);
    }
}

// Schedule the script to run every 5 minutes
schedule.scheduleJob('*/5 * * * *', () => {
    runUpdate();
});

console.log('[Data Loader] Data loader scheduled to run every 5 minutes.');
runUpdate(); // Run once on startup
