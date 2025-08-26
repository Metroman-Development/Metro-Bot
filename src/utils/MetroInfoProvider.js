const logger = require('../events/logger');
const { diff } = require('deep-diff');
const ApiService = require('../core/metro/core/services/ApiService');
const DbChangeDetector = require('../core/metro/core/services/changeDetectors/DbChangeDetector');
const ApiChangeDetector = require('../core/metro/core/services/changeDetectors/ApiChangeDetector');
const MyChangeDetector = require('../core/status/ChangeDetector');
const ChangeAnnouncer = require('../core/status/ChangeAnnouncer');

class MetroInfoProvider {
    static instance = null;

    constructor(metroCore, databaseService) {
        if (!metroCore || !databaseService) {
            throw new Error("MetroInfoProvider requires a metroCore and databaseService instance.");
        }
        this.metroCore = metroCore;
        this.databaseService = databaseService;
        this.data = {
            lines: {},
            stations: {},
            trains: {},
            intermodal: {
                stations: {},
                buses: {}
            },
            futureLines: {},
            accessibility: {},
            network_status: {},
            last_updated: null
        };
        this.isInitialized = true;

        const apiService = new ApiService(metroCore, { dbService: databaseService }, null);
        this.dbChangeDetector = new DbChangeDetector(databaseService);
        this.apiChangeDetector = new ApiChangeDetector(apiService);
        this.changeDetector = new MyChangeDetector();
        this.changeAnnouncer = new ChangeAnnouncer();

        logger.info('[MetroInfoProvider] MetroInfoProvider initialized.');
    }

    static initialize(metroCore, databaseService) {
        if (!MetroInfoProvider.instance) {
            MetroInfoProvider.instance = new MetroInfoProvider(metroCore, databaseService);
        }
        return MetroInfoProvider.instance;
    }

    static getInstance() {
        if (!MetroInfoProvider.instance) {
            throw new Error("MetroInfoProvider has not been initialized. Call initialize() first.");
        }
        return MetroInfoProvider.instance;
    }

    updateData(newData) {
        if (!newData) {
            logger.warn('[MetroInfoProvider] Attempted to update with null or undefined data.');
            return;
        }
        this.data = { ...this.data, ...newData };
        this.lastUpdated = new Date();
        logger.debug('[MetroInfoProvider] Data updated.', { keys: Object.keys(newData) });
    }

    updateFromDb(dbData) {
        if (!dbData) return;
        const transformedData = this.transformDbData(dbData);
        this.updateData(transformedData);
    }

    transformDbData(dbData) {
        const currentData = this.getFullData();

        for (const stationId in dbData.stations) {
            if (!currentData.stations[stationId]) {
                currentData.stations[stationId] = {};
            }
            Object.assign(currentData.stations[stationId], dbData.stations[stationId]);
        }

        for (const lineId in dbData.lines) {
            if (!currentData.lines[lineId]) {
                currentData.lines[lineId] = {};
            }
            Object.assign(currentData.lines[lineId], dbData.lines[lineId]);
        }

        return currentData;
    }

    updateFromApi(apiData) {
        const currentData = this.getFullData();
        currentData.lines = apiData.lineas;
        currentData.network_status = apiData.network;

        for (const lineId in apiData.lineas) {
            if (apiData.lineas[lineId].estaciones) {
                for (const station of apiData.lineas[lineId].estaciones) {
                    const stationId = station.id_estacion.toUpperCase();
                    if (!currentData.stations[stationId]) {
                        currentData.stations[stationId] = {};
                    }
                    Object.assign(currentData.stations[stationId], station);
                }
                currentData.lines[lineId].stations = apiData.lineas[lineId].estaciones;
            }
        }
        this.updateData(currentData);
    }

    async compareAndSyncData(apiData, dbData) {
        const oldData = JSON.parse(JSON.stringify(this.getFullData()));

        const apiTimestamp = await this.apiChangeDetector.getLatestChangeTimestamp();
        const dbTimestamp = await this.dbChangeDetector.getLatestChangeTimestamp();

        if (apiTimestamp > dbTimestamp) {
            this.updateFromApi(apiData);
            await this.dbChangeDetector.databaseService.updateStatusFromApi(apiData);
        } else {
            this.updateFromDb(dbData);
        }

        const newData = this.getFullData();
        const changes = this.changeDetector.detect(oldData, newData);

        if (changes && changes.length > 0) {
            const messages = await this.changeAnnouncer.generateMessages(changes, newData);
        }
    }

    getStationDetails(stationName) {
        const station = this.getStationById(stationName);
        if (!station) {
            return null;
        }

        const line = this.data.lines[station.line_id];
        const lineStatus = line ? line.status_message : 'No disponible';
        const stationStatus = station.status ? station.status.message : 'No disponible';

        const isOperational = (lineStatus === 'Operativa' || lineStatus === 'Disponible') && (stationStatus === 'Operativa' || stationStatus === 'Disponible');

        const platforms = station.platforms ? station.platforms.map(p => ({
            ...p,
            status: isOperational ? 'operational' : 'non-operational'
        })) : [];

        const intermodal = this.getIntermodalBuses(station.station_name);

        return {
            name: station.station_name,
            line: station.line_id,
            route: station.route_color,
            express_state: station.express_state,
            transfer: station.combinacion ? `L${station.combinacion}` : null,
            connections: station.connections || [],
            details: {
                schematics: station.access_details,
                services: station.services,
                accessibility: station.accessibility,
                amenities: station.amenities,
                municipality: station.commune,
            },
            platforms: platforms,
            intermodal: intermodal,
            status: {
                code: station.status?.code || '0',
                message: station.status?.message || '',
                nombre: station.nombre,
                codigo: station.codigo,
                estado: station.estado,
                descripcion: station.descripcion,
                descripcion_app: station.descripcion_app,
                status_data: station.status_data
            },
        };
    }

    getFullData() {
        return this.data;
    }

    getLine(lineId) {
        return this.data.lines?.[lineId] || null;
    }

    getStation(stationId) {
        return this.data.stations?.[stationId] || null;
    }

    getStationById(stationId) {
        if (typeof stationId === 'number') {
            return this.data.stations[stationId];
        }
        if (typeof stationId === 'string') {
            const normalizedId = stationId.toLowerCase();
            return Object.values(this.data.stations).find(s => (s.name || s.nombre || '').toLowerCase() === normalizedId);
        }
        return null;
    }

    getIntermodalBuses(stationName) {
        return this.data.intermodal.buses[stationName];
    }
}

module.exports = MetroInfoProvider;
