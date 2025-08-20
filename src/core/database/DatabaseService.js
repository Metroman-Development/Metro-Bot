const DatabaseManager = require('./DatabaseManager');
const logger = require('../../events/logger');

class DatabaseService {
    constructor(dbManager) {
        if (!dbManager) {
            const errorMessage = '[DatabaseService] DatabaseManager instance is required.';
            logger.error(errorMessage);
            throw new Error(errorMessage);
        }
        this.db = dbManager;
    }

    static #instance = null;

    static async getInstance(dbManager) {
        if (this.#instance) {
            return this.#instance;
        }

        if (!dbManager) {
            throw new Error('[DatabaseService] A DatabaseManager instance must be provided to getInstance.');
        }

        this.#instance = new DatabaseService(dbManager);
        return this.#instance;
    }

    async updateChanges(changes) {
        logger.info(`[DatabaseService] Starting partial database update with ${changes.length} changes...`);
        if (!changes || changes.length === 0) {
            logger.info('[DatabaseService] No changes to update.');
            return;
        }

        const connection = await this.db.pool.getConnection();
        try {
            await connection.beginTransaction();

            for (const change of changes) {
                if (change.type === 'line') {
                    await this.updateLineStatus(connection, {
                        lineId: change.id,
                        statusCode: change.to.code,
                        statusMessage: change.to.message,
                        appMessage: change.to.appMessage
                    });
                } else if (change.type === 'station') {
                    await this._updateStationStatusInTransaction(connection, {
                        stationCode: change.id,
                        lineId: change.line,
                        statusCode: change.to.code,
                        statusDescription: change.to.message,
                        appDescription: change.to.appMessage
                    });
                }
            }

            await connection.commit();
            logger.info(`[DatabaseService] Successfully updated ${changes.length} changes.`);
        } catch (error) {
            await connection.rollback();
            logger.error('[DatabaseService] Partial data update failed:', { error });
            throw error;
        } finally {
            connection.release();
        }
    }

    async updateAllData(processedData) {
        const data = await processedData;
        logger.info('[DatabaseService] Starting full database update from processed data...');

        if (!data || !data.lines || typeof data.lines !== 'object' || Object.keys(data.lines).length === 0) {
            logger.warn('[DatabaseService] updateAllData called with invalid or empty data.');
            return;
        }

        const connection = await this.db.pool.getConnection();
        try {
            await connection.beginTransaction();

            for (const lineId in data.lines) {
                const line = data.lines[lineId];
                await this.updateLineStatus(connection, {
                    lineId: line.id,
                    statusCode: line.status.code,
                    statusMessage: line.status.message,
                    appMessage: line.status.appMessage
                });

                if (line.stations) {
                    for (const stationId of line.stations) {
                        const station = data.stations[stationId.toUpperCase()];
                        if (station) {
                            if (station.status && station.status.code) {
                                await this._updateStationStatusInTransaction(connection, {
                                    stationCode: station.id,
                                    lineId: station.line,
                                    statusCode: station.status.code,
                                    statusDescription: station.status.message,
                                    appDescription: station.status.appMessage
                                });
                            } else {
                                logger.warn(`[DatabaseService] Station ${station.id} has no status code, skipping status update.`);
                            }
                        }
                    }
                }
            }

            await connection.commit();
        } catch (error) {
            await connection.rollback();
            logger.error('[DatabaseService] Full data update failed:', { error });
            throw error;
        } finally {
            connection.release();
        }
    }

    async updateStation(station) {
        // 1. Validate data
        if (!station.commune || !station.estado) {
            logger.warn(`[DatabaseService] Skipping station ${station.station_code} due to missing 'commune' or 'estado' data.`);
            return;
        }

        // 2. Update metro_stations table
        const stationQuery = `
            INSERT INTO metro_stations (
                line_id, station_code, station_name, display_name, display_order,
                commune, address, latitude, longitude, location,
                transports, services, accessibility, commerce, amenities, image_url, access_details,
                opened_date, last_renovation_date, combinacion
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, POINT(?, ?), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                access_details = VALUES(access_details),
                opened_date = VALUES(opened_date),
                last_renovation_date = VALUES(last_renovation_date),
                combinacion = VALUES(combinacion)
        `;

        const longitude = parseFloat(station.longitude);
        const latitude = parseFloat(station.latitude);
        const validPoint = !isNaN(longitude) && !isNaN(latitude);

        await this.db.query(stationQuery, [
            station.line_id, station.station_code, station.station_name, station.display_name, station.display_order,
            station.commune, station.address, station.latitude, station.longitude,
            validPoint ? longitude : 0, validPoint ? latitude : 0,
            station.transports, station.services, station.accessibility, station.commerce, station.amenities, station.image_url,
            station.access_details ? JSON.stringify(station.access_details) : null,
            station.opened_date, station.last_renovation_date, station.combinacion
        ]);

        // 3. Update station_status table
        await this.updateStationStatus(
            station.station_code,
            station.line_id,
            station.estado,
            station.descripcion,
            station.descripcion_app
        );

        // 4. Update accessibility_status table
        if (station.access_details && Array.isArray(station.access_details)) {
            for (const item of station.access_details) {
                await this.updateAccessibilityStatus(
                    item.equipment_id,
                    item.station_code,
                    item.line_id,
                    item.status,
                    item.type,
                    item.text
                );
            }
        }
    }

    async updateIncidents(data) {
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
                await this.db.query(query, [
                    incident.incident_id, incident.incident_type_id, incident.station_id, incident.line_id, incident.description,
                    incident.severity_level, incident.status, incident.photo_url, incident.reported_by, incident.resolved_at, incident.resolved_by
                ]);
            }
        }
    }

    async updateSystemInfo(data) {
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
            await this.db.query(query, [
                info.id, info.name, info.system, info.inauguration, info.length, info.stations, info.track_gauge, info.electrification,
                info.max_speed, info.status, info.lines, info.cars, info.passengers, info.fleet, info.average_speed, info.operator,
                info.map_url, JSON.stringify(info.events)
            ]);
        }
    }

    async updateTrainModels(data) {
        if (data.trainModels && Array.isArray(data.trainModels)) {
            for (const model of data.trainModels) {
                const query = `
                    INSERT INTO train_models (model_id, model_data)
                    VALUES (?, ?)
                    ON DUPLICATE KEY UPDATE model_data = VALUES(model_data)
                `;
                await this.db.query(query, [model.model_id, JSON.stringify(model.model_data)]);
            }
        }
    }

    async updateLineFleet(data) {
        if (data.lineFleet && Array.isArray(data.lineFleet)) {
            for (const fleet of data.lineFleet) {
                const query = `
                    INSERT INTO line_fleet (id, line_id, model_id)
                    VALUES (?, ?, ?)
                    ON DUPLICATE KEY UPDATE line_id = VALUES(line_id), model_id = VALUES(model_id)
                `;
                await this.db.query(query, [fleet.id, fleet.line_id, fleet.model_id]);
            }
        }
    }

    async updateStatusOverrides(data) {
        if (data.statusOverrides && Array.isArray(data.statusOverrides)) {
            for (const override of data.statusOverrides) {
                const query = `
                    INSERT INTO status_overrides (id, target_type, target_id, status, message, source, expires_at, is_active)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE
                        target_type = VALUES(target_type), target_id = VALUES(target_id), status = VALUES(status), message = VALUES(message),
                        source = VALUES(source), expires_at = VALUES(expires_at), is_active = VALUES(is_active)
                `;
                await this.db.query(query, [
                    override.id, override.target_type, override.target_id, override.status, override.message,
                    override.source, override.expires_at, override.is_active
                ]);
            }
        }
    }

    async updateScheduledStatusOverrides(data) {
        if (data.scheduledStatusOverrides && Array.isArray(data.scheduledStatusOverrides)) {
            for (const override of data.scheduledStatusOverrides) {
                const query = `
                    INSERT INTO scheduled_status_overrides (id, target_type, target_id, status, message, source, type, start_at, end_at, is_active)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE
                        target_type = VALUES(target_type), target_id = VALUES(target_id), status = VALUES(status), message = VALUES(message),
                        source = VALUES(source), type = VALUES(type), start_at = VALUES(start_at), end_at = VALUES(end_at), is_active = VALUES(is_active)
                `;
                await this.db.query(query, [
                    override.id, override.target_type, override.target_id, override.status, override.message,
                    override.source, override.type, override.start_at, override.end_at, override.is_active
                ]);
            }
        }
    }

    async updateIntermodalStations(data) {
        if (data.intermodalStations && Array.isArray(data.intermodalStations)) {
            for (const station of data.intermodalStations) {
                const query = `
                    INSERT INTO intermodal_stations (id, name, services, location, commune, inauguration, platforms, operator)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE
                        name = VALUES(name), services = VALUES(services), location = VALUES(location), commune = VALUES(commune),
                        inauguration = VALUES(inauguration), platforms = VALUES(platforms), operator = VALUES(operator)
                `;
                await this.db.query(query, [
                    station.id, station.name, station.services, station.location, station.commune,
                    station.inauguration, station.platforms, station.operator
                ]);
            }
        }
    }

    async updateIntermodalBuses(data) {
        if (data.intermodalBuses && Array.isArray(data.intermodalBuses)) {
            for (const bus of data.intermodalBuses) {
                const query = `
                    INSERT INTO intermodal_buses (id, station_id, type, route, destination)
                    VALUES (?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE
                        station_id = VALUES(station_id), type = VALUES(type), route = VALUES(route), destination = VALUES(destination)
                `;
                await this.db.query(query, [bus.id, bus.station_id, bus.type, bus.route, bus.destination]);
            }
        }
    }

    async updateNetworkStatus(data) {
        if (data.networkStatus) {
            const status = data.networkStatus;
            const query = `
                INSERT INTO network_status (id, network_status_summary, fare_period, active_event)
                VALUES (?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    network_status_summary = VALUES(network_status_summary), fare_period = VALUES(fare_period), active_event = VALUES(active_event)
            `;
            await this.db.query(query, [
                status.id, JSON.stringify(status.network_status_summary), status.fare_period, JSON.stringify(status.active_event)
            ]);
        }
    }


    // ... methods for line status
    async getLineStatus(lineId) {
        return this.db.query('SELECT status_code, status_message, app_message FROM metro_lines WHERE line_id = ?', [lineId]);
    }

    async getLineInfo(lineId) {
        const results = await this.db.query('SELECT * FROM metro_lines WHERE line_id = ?', [lineId]);
        return results.length > 0 ? results[0] : null;
    }

    async updateLineStatus(connection, data) {
        const { lineId, statusCode, statusMessage, appMessage } = data;
        return connection.query('UPDATE metro_lines SET status_code = ?, status_message = ?, app_message = ? WHERE line_id = ?', [statusCode, statusMessage, appMessage, lineId]);
    }

    // ... methods for station status
    async getStationStatus(stationCode, lineId) {
        // This is tricky because station_status uses station_id, not station_code
        const station = await this.db.query('SELECT station_id FROM metro_stations WHERE station_code = ? AND line_id = ?', [stationCode, lineId]);
        if (station.length === 0) return null;
        return this.db.query('SELECT ost.status_name, ss.status_description, ss.status_message FROM station_status ss JOIN operational_status_types ost ON ss.status_type_id = ost.status_type_id WHERE ss.station_id = ?', [station[0].station_id]);
    }

    async _updateStationStatusInTransaction(connection, data) {
        const { stationCode, lineId, statusCode, statusDescription, appDescription } = data;
        const statusType = await connection.query('SELECT status_type_id FROM js_status_mapping WHERE js_code = ?', [statusCode]);
        if (statusType.length === 0) {
            logger.warn(`[DatabaseService] JS code "${statusCode}" not found in js_status_mapping.`);
            return;
        }
        const statusTypeId = statusType[0].status_type_id;

        const station = await connection.query('SELECT station_id FROM metro_stations WHERE station_code = ? AND line_id = ?', [stationCode, lineId]);
        if (station.length === 0) {
            logger.warn(`[DatabaseService] Station with code "${stationCode}" on line "${lineId}" not found.`);
            return;
        }
        const stationId = station[0].station_id;

        return connection.query(
            'INSERT INTO station_status (station_id, status_type_id, status_description, status_message) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE status_type_id = ?, status_description = ?, status_message = ?',
            [stationId, statusTypeId, statusDescription, appDescription, statusTypeId, statusDescription, appDescription]
        );
    }

    async updateStationStatus(stationCode, lineId, jsCode, statusDescription, statusMessage) {
        const statusType = await this.db.query('SELECT status_type_id FROM js_status_mapping WHERE js_code = ?', [jsCode]);
        if (statusType.length === 0) {
            logger.warn(`[DatabaseService] JS code "${jsCode}" not found in js_status_mapping.`);
            return;
        }
        const statusTypeId = statusType[0].status_type_id;

        const station = await this.db.query('SELECT station_id FROM metro_stations WHERE station_code = ? AND line_id = ?', [stationCode, lineId]);
        if (station.length === 0) {
            logger.warn(`[DatabaseService] Station with code "${stationCode}" on line "${lineId}" not found.`);
            return;
        }
        const stationId = station[0].station_id;

        return this.db.query(
            'INSERT INTO station_status (station_id, status_type_id, status_description, status_message) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE status_type_id = ?, status_description = ?, status_message = ?',
            [stationId, statusTypeId, statusDescription, statusMessage, statusTypeId, statusDescription, statusMessage]
        );
    }

    async setAllStationsStatus(statusName, statusDescription, statusMessage) {
        const statusType = await this.db.query('SELECT status_type_id FROM operational_status_types WHERE status_name = ?', [statusName]);
        if (statusType.length === 0) {
            logger.warn(`[DatabaseService] Status name "${statusName}" not found in operational_status_types.`);
            return;
        }
        const statusTypeId = statusType[0].status_type_id;

        // This is a bulk update.
        // I need to get all station_ids first.
        const stations = await this.db.query('SELECT station_id FROM metro_stations');
        const stationIds = stations.map(s => s.station_id);

        const promises = stationIds.map(stationId => {
            const message = statusMessage || statusDescription;
            return this.db.query(
                'INSERT INTO station_status (station_id, status_type_id, status_description, status_message) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE status_type_id = ?, status_description = ?, status_message = ?',
                [stationId, statusTypeId, statusDescription, message, statusTypeId, statusDescription, message]
            );
        });

        return Promise.all(promises);
    }

    // ... methods for system info
    async getSystemEvents() {
        const result = await this.db.query('SELECT events FROM system_info WHERE id = ?', [1]);
        if (result.length > 0 && result[0].events) {
            return JSON.parse(result[0].events);
        }
        return [];
    }

    async getSystemInfo() {
        const results = await this.db.query('SELECT * FROM system_info WHERE id = ?', [1]);
        return results.length > 0 ? results[0] : null;
    }

    async updateSystemEvents(events) {
        const eventsJson = JSON.stringify(events);
        return this.db.query('UPDATE system_info SET events = ? WHERE id = ?', [eventsJson, 1]);
    }

    // ... methods for accessibility
    async getStationAccessibility(stationCode, lineId) {
        const station = await this.db.query('SELECT station_id FROM metro_stations WHERE station_code = ? AND line_id = ?', [stationCode, lineId]);
        if (station.length === 0) return null;

        // What to return here? The accessibility info is in a JSON file, not in the DB directly in a structured way.
        // `metro_stations` has `access_details` as JSON, and `accessibility` as TEXT.
        // Let's assume we are dealing with `access_details`.
        return this.db.query('SELECT access_details FROM metro_stations WHERE station_id = ?', [station[0].station_id]);
    }

    async updateStationAccessibility(stationCode, lineId, accessibilityInfo) {
        const station = await this.db.query('SELECT station_id FROM metro_stations WHERE station_code = ? AND line_id = ?', [stationCode, lineId]);
        if (station.length === 0) return;
        const stationId = station[0].station_id;
        const accessibilityJson = JSON.stringify(accessibilityInfo);
        return this.db.query('UPDATE metro_stations SET access_details = ? WHERE station_id = ?', [accessibilityJson, stationId]);
    }

    async getAllLinesStatus() {
        return this.db.query('SELECT line_id, line_name, status_code, status_message, app_message FROM metro_lines');
    }

    async getAllStationsStatusAsRaw() {
        // This query now explicitly selects all columns from metro_stations to avoid ambiguity with `s.*`
        // and to ensure all data is being fetched.
        // It also provides clear aliases for fields from joined tables.
        return this.db.query(`
            SELECT
                s.station_id, s.line_id, s.station_code, s.station_name, s.display_order, s.commune, s.address, s.latitude, s.longitude, s.location, s.opened_date, s.last_renovation_date, s.created_at, s.updated_at, s.display_name, s.transports, s.services, s.accessibility, s.commerce, s.amenities, s.image_url, s.access_details, s.combinacion,
                ss.status_id,
                ss.status_type_id,
                ss.status_description AS station_status_description,
                ss.status_message,
                ss.expected_resolution_time,
                ss.is_planned,
                ss.impact_level,
                ss.last_updated AS station_status_last_updated,
                ss.updated_by,
                ost.status_name,
                ost.is_operational,
                s.station_name AS nombre,
                jsm.js_code AS estado,
                ost.status_description AS descripcion,
                ost.status_description AS descripcion_app
            FROM metro_stations s
            LEFT JOIN station_status ss ON s.station_id = ss.station_id
            LEFT JOIN operational_status_types ost ON ss.status_type_id = ost.status_type_id
            LEFT JOIN js_status_mapping jsm ON ost.status_type_id = jsm.status_type_id
        `);
    }

    async updateNetworkStatusSummary(summary) {
        const summaryJson = JSON.stringify(summary);
        return this.db.query(
            'INSERT INTO network_status (id, network_status_summary) VALUES (1, ?) ON DUPLICATE KEY UPDATE network_status_summary = ?',
            [summaryJson, summaryJson]
        );
    }

    async updateFarePeriod(farePeriod) {
        return this.db.query(
            'INSERT INTO network_status (id, fare_period) VALUES (1, ?) ON DUPLICATE KEY UPDATE fare_period = ?',
            [farePeriod, farePeriod]
        );
    }

    async updateActiveEvent(event) {
        const eventJson = event ? JSON.stringify(event) : null;
        return this.db.query(
            'INSERT INTO network_status (id, active_event) VALUES (1, ?) ON DUPLICATE KEY UPDATE active_event = ?',
            [eventJson, eventJson]
        );
    }

    async getAccessibilityStatus() {
        return this.db.query('SELECT * FROM accessibility_status');
    }

    async updateAccessibilityStatus(equipmentId, stationCode, lineId, status, type, text) {
        return this.db.query(
            'INSERT INTO accessibility_status (equipment_id, station_code, line_id, status, type, text) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE station_code = ?, line_id = ?, status = ?, type = ?, text = ?',
            [equipmentId, stationCode, lineId, status, type, text, stationCode, lineId, status, type, text]
        );
    }

    async deleteAccessibilityStatus(equipmentId) {
        return this.db.query('DELETE FROM accessibility_status WHERE equipment_id = ?', [equipmentId]);
    }

    async getIntermodalStations() {
        return this.db.query('SELECT * FROM intermodal_stations');
    }

    async getIntermodalBuses(stationId) {
        return this.db.query('SELECT * FROM intermodal_buses WHERE station_id = ?', [stationId]);
    }

    async getAllStations() {
        return this.db.query('SELECT * FROM metro_stations');
    }

    async getBotVersion() {
        const results = await this.db.query('SELECT version, release_date, changelog FROM bot_versions ORDER BY created_at DESC LIMIT 1');
        return results.length > 0 ? results[0] : null;
    }

    // New methods for fetching data from all tables

    async getAllIncidents() {
        return this.db.query('SELECT * FROM incidents');
    }

    async getAllIncidentTypes() {
        return this.db.query('SELECT * FROM incident_types');
    }

    async getAllTrainModels() {
        return this.db.query('SELECT * FROM train_models');
    }

    async getAllLineFleet() {
        return this.db.query('SELECT * FROM line_fleet');
    }

    async getAllStatusOverrides() {
        return this.db.query('SELECT * FROM status_overrides');
    }

    async getAllScheduledStatusOverrides() {
        return this.db.query('SELECT * FROM scheduled_status_overrides');
    }

    async getAllJsStatusMapping() {
        return this.db.query('SELECT * FROM js_status_mapping');
    }

    async getAllOperationalStatusTypes() {
        return this.db.query('SELECT * FROM operational_status_types');
    }

    async getAllStationStatusHistory() {
        return this.db.query('SELECT * FROM station_status_history');
    }

    async getAllStatusChangeLog() {
        return this.db.query('SELECT * FROM status_change_log');
    }

    async getAllIntermodalBuses() {
        return this.db.query('SELECT * FROM intermodal_buses');
    }

    async getNetworkStatus() {
        const results = await this.db.query('SELECT * FROM network_status WHERE id = ?', [1]);
        return results.length > 0 ? results[0] : null;
    }

    async getLatestChange() {
        const results = await this.db.query('SELECT * FROM status_change_log ORDER BY changed_at DESC LIMIT 1');
        return results.length > 0 ? results[0] : null;
    }
}

module.exports = DatabaseService;
