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

    // ... methods for line status
    async getLineStatus(lineId) {
        return this.db.query('SELECT status_code, status_message, app_message FROM metro_lines WHERE line_id = ?', [lineId]);
    }

    async getLineInfo(lineId) {
        const results = await this.db.query('SELECT * FROM metro_lines WHERE line_id = ?', [lineId]);
        return results.length > 0 ? results[0] : null;
    }

    async updateLineStatus(lineId, statusCode, statusMessage, appMessage) {
        return this.db.query('UPDATE metro_lines SET status_code = ?, status_message = ?, app_message = ? WHERE line_id = ?', [statusCode, statusMessage, appMessage, lineId]);
    }

    // ... methods for station status
    async getStationStatus(stationCode, lineId) {
        // This is tricky because station_status uses station_id, not station_code
        const station = await this.db.query('SELECT station_id FROM metro_stations WHERE station_code = ? AND line_id = ?', [stationCode, lineId]);
        if (station.length === 0) return null;
        return this.db.query('SELECT ost.status_name, ss.status_description, ss.status_message FROM station_status ss JOIN operational_status_types ost ON ss.status_type_id = ost.status_type_id WHERE ss.station_id = ?', [station[0].station_id]);
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

    async setAllStationsStatus(statusName, statusDescription) {
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
            return this.db.query(
                'INSERT INTO station_status (station_id, status_type_id, status_description) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE status_type_id = ?, status_description = ?',
                [stationId, statusTypeId, statusDescription, statusTypeId, statusDescription]
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
        return this.db.query(`
            SELECT s.*, s.station_name as nombre, jsm.js_code as estado, ost.status_description as descripcion, ost.status_description as descripcion_app
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
}

module.exports = DatabaseService;
