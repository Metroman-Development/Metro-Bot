const logger = require('../../../../events/logger');
const config = require('../../../../config/metro/metroConfig');

class DbDataManager {
    constructor(dbService) {
        if (!dbService) {
            throw new Error('[DbDataManager] A dbService instance is required.');
        }
        this.dbService = dbService;
        this.lineInfoMap = new Map();
        logger.info('[DbDataManager] Initialized.');
    }

    async _initializeLineMetadata() {
        try {
            const dbLines = await this.dbService.getAllLinesStatus();
            for (const line of dbLines) {
                this.lineInfoMap.set(line.line_id.toLowerCase(), line.line_name);
            }
            logger.info('[DbDataManager] Line metadata initialized successfully.');
        } catch (error) {
            logger.error('[DbDataManager] Failed to initialize line metadata', { error });
        }
    }

    async _generateOffHoursData() {
        const dbData = await this.getDbRawData();
        if (!dbData || !dbData.lines) {
            logger.error('[DbDataManager] Cannot generate off-hours data: no data from database.');
            return { lines: {} };
        }

        const offHoursData = JSON.parse(JSON.stringify(dbData));

        for (const lineId in offHoursData.lines) {
            const line = offHoursData.lines[lineId];
            line.estado = '15';
            line.mensaje = 'Fuera de Horario Operativo';
            line.mensaje_app = 'Fuera de Horario Operativo';

            if (line.estaciones) {
                for (const station of line.estaciones) {
                    station.estado = '15';
                    station.descripcion = 'Fuera de Horario Operativo';
                    station.descripcion_app = 'Fuera de Horario Operativo';
                }
            }
        }

        offHoursData.network = {
            status: 'closed',
            timestamp: new Date().toISOString()
        };

        return offHoursData;
    }

    async activateExpressService() {
        logger.info('[DbDataManager] Activating express service...');
        const expressLines = config.expressLines;
        for (const lineId of expressLines) {
            const query = `UPDATE metro_lines SET express_status = 'active' WHERE line_id = ?`;
            await this.dbService.query(query, [lineId.toLowerCase()]);
            logger.info(`[DbDataManager] Express service activated for line ${lineId}`);
        }
    }

    async deactivateExpressService() {
        logger.info('[DbDataManager] Deactivating express service...');
        const expressLines = config.expressLines;
        for (const lineId of expressLines) {
            const query = `UPDATE metro_lines SET express_status = 'inactive' WHERE line_id = ?`;
            await this.dbService.query(query, [lineId.toLowerCase()]);
            logger.info(`[DbDataManager] Express service deactivated for line ${lineId}`);
        }
    }

    async getDbRawData() {
        logger.info('[DbDataManager] FORCING DATABASE READ FOR DEBUGGING.');
        const [
            dbLines,
            dbStationsStatus,
            accessibilityStatus,
            incidents,
            incidentTypes,
            trainModels,
            lineFleet,
            statusOverrides,
            scheduledStatusOverrides,
            jsStatusMapping,
            operationalStatusTypes,
            changeHistory,
            systemInfo,
            intermodalStations,
            intermodalBuses,
            networkStatus
        ] = await Promise.all([
            this.dbService.getAllLinesStatus(),
            this.dbService.getAllStationsStatusAsRaw(),
            this.dbService.getAccessibilityStatus(),
            this.dbService.getAllIncidents(),
            this.dbService.getAllIncidentTypes(),
            this.dbService.getAllTrainModels(),
            this.dbService.getAllLineFleet(),
            this.dbService.getAllStatusOverrides(),
            this.dbService.getAllScheduledStatusOverrides(),
            this.dbService.getAllJsStatusMapping(),
            this.dbService.getAllOperationalStatusTypes(),
            this.dbService.getChangeHistory(),
            this.dbService.getSystemInfo(),
            this.dbService.getIntermodalStations(),
            this.dbService.getAllIntermodalBuses(),
            this.dbService.getNetworkStatus()
        ]);

        const accessibilityByStation = {};
        for (const item of accessibilityStatus) {
            const stationCode = item.station_code.toUpperCase();
            if (!accessibilityByStation[stationCode]) {
                accessibilityByStation[stationCode] = [];
            }
            accessibilityByStation[stationCode].push(item);
        }

        const rawData = {
            lines: {},
            incidents,
            incidentTypes,
            trainModels,
            lineFleet,
            statusOverrides,
            scheduledStatusOverrides,
            jsStatusMapping,
            operationalStatusTypes,
            changeHistory,
            systemInfo,
            intermodalStations,
            intermodalBuses,
            networkStatus
        };

        for (const line of dbLines) {
            const lineId = line.line_id.toLowerCase();
            rawData.lines[lineId] = {
                nombre: line.line_name,
                estado: line.status_code,
                mensaje: line.status_message,
                mensaje_app: line.app_message,
                estaciones: []
            };
        }

        const stationsArray = Array.isArray(dbStationsStatus) ? dbStationsStatus : Object.values(dbStationsStatus);

        for (const station of stationsArray) {
            const lineId = station.line_id.toLowerCase();
            if (rawData.lines[lineId]) {
                const stationCode = station.station_code.toUpperCase();
                rawData.lines[lineId].estaciones.push({
                    ...station,
                    codigo: stationCode,
                    nombre: station.station_name,
                    estado: station.status_data?.js_code || null,
                    descripcion: station.status_data?.status_description || null,
                    descripcion_app: station.status_data?.status_message || null,
                    access_details: accessibilityByStation[stationCode] || []
                });
            }
        }

        return rawData;
    }
}

module.exports = DbDataManager;
