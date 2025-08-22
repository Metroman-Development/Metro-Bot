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

    async updateAllData(currentData) {
        const data = await currentData;
        logger.info('[DatabaseService] Starting bulk database update from processed data...');

        if (!data || !data.lines || typeof data.lines !== 'object' || Object.keys(data.lines).length === 0) {
            logger.warn('[DatabaseService] updateAllData called with invalid or empty data.');
            return;
        }

        const connection = await this.db.pool.getConnection();
        try {
            await connection.beginTransaction();

            // 1. Prepare data for bulk operations
            const linesToUpdate = [];
            const stationsToInsert = [];
            const stationStatusesToUpdate = [];

            for (const lineId in data.lines) {
                const line = data.lines[lineId];
                linesToUpdate.push({
                    lineId: line.id,
                    statusCode: line.status.code,
                    statusMessage: line.status.message,
                    appMessage: line.status.appMessage
                });

                if (line.stations) {
                    for (const stationId of line.stations) {
                        const station = data.stations[stationId.toUpperCase()];
                        if (station) {
                            stationsToInsert.push(station);
                            if (station.status && station.status.code) {
                                stationStatusesToUpdate.push({
                                    stationCode: station.id,
                                    lineId: station.line,
                                    statusCode: station.status.code,
                                    statusDescription: station.status.message,
                                    appDescription: station.status.appMessage
                                });
                            }
                        }
                    }
                }
            }

            // 2. Bulk insert/update lines
            if (linesToUpdate.length > 0) {
                const lineQuery = `
                    INSERT INTO metro_lines (line_id, line_name, status_code, status_message, app_message)
                    VALUES ${linesToUpdate.map(() => '(?, ?, ?, ?, ?)').join(',')}
                    ON DUPLICATE KEY UPDATE
                        line_name = VALUES(line_name),
                        status_code = VALUES(status_code),
                        status_message = VALUES(status_message),
                        app_message = VALUES(app_message)
                `;
                const lineParams = linesToUpdate.flatMap(l => [
                    l.lineId,
                    data.lines[l.lineId].name || `Línea ${l.lineId.toUpperCase().replace('L', '')}`,
                    l.statusCode,
                    l.statusMessage,
                    l.appMessage
                ]);
                await connection.query(lineQuery, lineParams);
            }

            // 3. Bulk insert/update stations
            if (stationsToInsert.length > 0) {
                for (const s of stationsToInsert) {
                    const longitude = parseFloat(s.longitude);
                    const latitude = parseFloat(s.latitude);
                    const validPoint = !isNaN(longitude) && !isNaN(latitude);

                    const stationData = {
                        line_id: s.line,
                        station_code: s.id,
                        station_name: s.name,
                        display_name: s.displayName,
                        display_order: s.display_order || null,
                        commune: s.commune || null,
                        address: s.address || null,
                        latitude: s.latitude || null,
                        longitude: s.longitude || null,
                        location: validPoint ? `POINT(${longitude} ${latitude})` : null,
                        transports: s.transports || null,
                        services: s.services || null,
                        accessibility: s.accessibility || null,
                        commerce: s.commerce || null,
                        amenities: s.amenities || null,
                        image_url: s.image_url || null,
                        access_details: s.access_details ? JSON.stringify(s.access_details) : null,
                        opened_date: s.opened_date || null,
                        last_renovation_date: s.last_renovation_date || null,
                        combinacion: s.combinacion || null
                    };

                    const { query, params } = this._buildDynamicUpdateQuery('metro_stations', stationData, 'station_code');
                    await connection.query(query, params);
                }
            }

            // 4. Bulk update station statuses
            if (stationStatusesToUpdate.length > 0) {
                // We need station_id and status_type_id for this. We can fetch them in bulk.
                const stationCodes = stationStatusesToUpdate.map(s => s.stationCode);
                const jsCodes = stationStatusesToUpdate.map(s => s.statusCode);

                const stationIdResults = await connection.query(
                    `SELECT station_id, station_code, line_id FROM metro_stations WHERE station_code IN (?)`,
                    [stationCodes]
                );
                const stationIdMap = new Map(stationIdResults.map(r => [`${r.station_code}-${r.line_id}`, r.station_id]));

                const statusTypeIdResults = await connection.query(
                    `SELECT status_type_id, js_code FROM js_status_mapping WHERE js_code IN (?)`,
                    [jsCodes]
                );
                const statusTypeIdMap = new Map(statusTypeIdResults.map(r => [r.js_code, r.status_type_id]));

                const statusValues = stationStatusesToUpdate.map(s => {
                    const stationId = stationIdMap.get(`${s.stationCode}-${s.lineId}`);
                    const statusTypeId = statusTypeIdMap.get(s.statusCode);
                    if (!stationId || !statusTypeId) return null;
                    return [stationId, statusTypeId, s.statusDescription, s.appDescription];
                }).filter(Boolean);

                if (statusValues.length > 0) {
                    const statusQuery = `
                        INSERT INTO station_status (station_id, status_type_id, status_description, status_message)
                        VALUES ${statusValues.map(() => '(?, ?, ?, ?)').join(',')}
                        ON DUPLICATE KEY UPDATE
                            status_type_id = VALUES(status_type_id),
                            status_description = VALUES(status_description),
                            status_message = VALUES(status_message)
                    `;
                    const statusParams = statusValues.flat();
                    await connection.query(statusQuery, statusParams);
                }
            }

            await connection.commit();
            logger.info('[DatabaseService] Bulk database update completed successfully.');
        } catch (error) {
            await connection.rollback();
            logger.error('[DatabaseService] Bulk data update failed:', { error });
            throw error;
        } finally {
            connection.release();
        }
    }

    _buildDynamicUpdateQuery(tableName, data, primaryKey) {
        const insertData = { ...data };
        const updateData = { ...data };
        delete updateData[primaryKey];

        const insertColumns = Object.keys(insertData).join(', ');
        const insertPlaceholders = Object.keys(insertData).map(() => '?').join(', ');
        const insertValues = Object.values(insertData);

        const updateClauses = Object.keys(updateData)
            .filter(key => updateData[key] !== null && updateData[key] !== undefined)
            .map(key => `${key} = VALUES(${key})`)
            .join(', ');

        if (updateClauses.length === 0) {
            return {
                query: `INSERT IGNORE INTO ${tableName} (${insertColumns}) VALUES (${insertPlaceholders})`,
                params: insertValues
            };
        }

        const query = `
            INSERT INTO ${tableName} (${insertColumns})
            VALUES (${insertPlaceholders})
            ON DUPLICATE KEY UPDATE ${updateClauses}
        `;

        return { query, params: insertValues };
    }

    async updateStation(station) {
        // 1. Validate data
        if (!station.commune || !station.estado) {
            logger.warn(`[DatabaseService] Skipping station ${station.station_code} due to missing 'commune' or 'estado' data.`);
            return;
        }

        // 2. Update metro_stations table
        const longitude = parseFloat(station.longitude);
        const latitude = parseFloat(station.latitude);
        const validPoint = !isNaN(longitude) && !isNaN(latitude);

        const stationData = {
            line_id: station.line_id,
            station_code: station.station_code,
            station_name: station.station_name,
            display_name: station.display_name,
            display_order: station.display_order,
            commune: station.commune,
            address: station.address,
            latitude: station.latitude,
            longitude: station.longitude,
            location: validPoint ? `POINT(${longitude} ${latitude})` : null,
            transports: station.transports,
            services: station.services,
            accessibility: station.accessibility,
            commerce: station.commerce,
            amenities: station.amenities,
            image_url: station.image_url,
            access_details: station.access_details ? JSON.stringify(station.access_details) : null,
            opened_date: station.opened_date,
            last_renovation_date: station.last_renovation_date,
            combinacion: station.combinacion
        };

        const { query, params } = this._buildDynamicUpdateQuery('metro_stations', stationData, 'station_code');
        await this.db.query(query, params);

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

    async _insertStationInTransaction(connection, station) {
        const longitude = parseFloat(station.longitude);
        const latitude = parseFloat(station.latitude);
        const validPoint = !isNaN(longitude) && !isNaN(latitude);

        const stationData = {
            line_id: station.line,
            station_code: station.id,
            station_name: station.name,
            display_name: station.displayName,
            display_order: station.display_order || null,
            commune: station.commune || null,
            address: station.address || null,
            latitude: station.latitude || null,
            longitude: station.longitude || null,
            location: validPoint ? `POINT(${longitude} ${latitude})` : null,
            transports: station.transports || null,
            services: station.services || null,
            accessibility: station.accessibility || null,
            commerce: station.commerce || null,
            amenities: station.amenities || null,
            image_url: station.image_url || null,
            access_details: station.access_details ? JSON.stringify(station.access_details) : null,
            opened_date: station.opened_date || null,
            last_renovation_date: station.last_renovation_date || null,
            combinacion: station.combinacion || null
        };

        const { query, params } = this._buildDynamicUpdateQuery('metro_stations', stationData, 'station_code');
        await connection.query(query, params);
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
    try {
        // First get all basic station data
        const stationsQuery = `
            SELECT 
                station_id, line_id, station_code, station_name, display_order,
                commune, address, latitude, longitude, location,
                opened_date, last_renovation_date, created_at, updated_at,
                display_name, transports, services, accessibility, commerce,
                amenities, image_url, access_details, combinacion
            FROM metro_stations 
            ORDER BY line_id, display_order
        `;
        
        const stations = await this.db.query(stationsQuery);
        
        // Then get status information separately
        const statusQuery = `
            SELECT 
                ss.station_id,
                ss.status_type_id,
                ss.status_description,
                ss.status_message,
                ss.expected_resolution_time,
                ss.is_planned,
                ss.impact_level,
                ss.last_updated,
                ss.updated_by,
                ost.status_name,
                ost.is_operational,
                ost.status_description as operational_status_desc,
                jsm.js_code
            FROM station_status ss
            LEFT JOIN operational_status_types ost ON ss.status_type_id = ost.status_type_id
            LEFT JOIN js_status_mapping jsm ON ost.status_type_id = jsm.status_type_id
        `;
        
        const statusData = await this.db.query(statusQuery);
        
        // Create a lookup map for status data
        const statusMap = {};
        statusData.forEach(status => {
            statusMap[status.station_id] = status;
        });
        
        // Combine the data
        return stations.map(station => ({
            ...station,
            status_data: statusMap[station.station_id] || null
        }));
        
    } catch (error) {
        logger.error('[DatabaseService] Error in getAllStationsStatusAsRaw:', error);
        throw error;
    }
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

    async logStatusChange(changeRecord) {
        const { type, id, from, to, timestamp } = changeRecord;

        const connection = await this.db.pool.getConnection();
        try {
            await connection.beginTransaction();

            const getStatusTypeId = async (statusCode) => {
                if (!statusCode) return null;
                const result = await connection.query('SELECT status_type_id FROM js_status_mapping WHERE js_code = ?', [statusCode]);
                return result.length > 0 ? result[0].status_type_id : null;
            };

            const oldStatusTypeId = await getStatusTypeId(from?.code);
            const newStatusTypeId = await getStatusTypeId(to.code);

            if (!newStatusTypeId) {
                logger.warn(`[DatabaseService] No status_type_id found for new status code: ${to.code}`);
                await connection.rollback();
                return;
            }

            let stationId = null;
            let lineId = null;

            if (type === 'station') {
                const stationResult = await connection.query('SELECT station_id, line_id FROM metro_stations WHERE station_code = ?', [id]);
                if (stationResult.length > 0) {
                    stationId = stationResult[0].station_id;
                    lineId = stationResult[0].line_id;
                } else {
                    logger.warn(`[DatabaseService] Station not found for code: ${id}`);
                    await connection.rollback();
                    return;
                }
            } else {
                lineId = id;
            }

            const query = `
                INSERT INTO status_change_log (station_id, line_id, old_status_type_id, new_status_type_id, change_description, is_planned, expected_duration_minutes, changed_by, changed_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            const description = `Status changed from ${from?.code || 'none'} to ${to.code}`;

            await connection.query(query, [
                stationId,
                lineId,
                oldStatusTypeId,
                newStatusTypeId,
                description,
                0, // is_planned
                null, // expected_duration_minutes
                'system', // changed_by
                timestamp
            ]);

            await connection.commit();
        } catch (error) {
            await connection.rollback();
            logger.error('[DatabaseService] Failed to log status change:', { error, changeRecord });
            throw error;
        } finally {
            connection.release();
        }
    }
}

module.exports = DatabaseService;
