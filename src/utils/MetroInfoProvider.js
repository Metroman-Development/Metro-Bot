const logger = require('../events/logger');
const { diff } = require('deep-diff');
const ApiService = require('../core/metro/core/services/ApiService');
const DbChangeDetector = require('../core/metro/core/services/changeDetectors/DbChangeDetector');
const ApiChangeDetector = require('../core/metro/core/services/changeDetectors/ApiChangeDetector');
const MyChangeDetector = require('../core/status/ChangeDetector');
const ChangeAnnouncer = require('../core/status/ChangeAnnouncer');
const StatusEmbedManager = require('../core/status/StatusEmbedManager');
const { normalizeStationData } = require('./stationUtils.js');

class MetroInfoProvider {
    static instance = null;

    constructor(metroCore, databaseService, statusEmbedManager) {
        if (!metroCore || !databaseService) {
            throw new Error("MetroInfoProvider requires a metroCore and databaseService instance.");
        }
        this.metroCore = metroCore;
        this.databaseService = databaseService;
        this.statusEmbedManager = statusEmbedManager;
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
            events: {},
            last_updated: null
        };
        this.isInitialized = true;

        this.apiService = new ApiService(metroCore, { dbService: databaseService }, null);
        this.dbChangeDetector = new DbChangeDetector(databaseService);
        this.apiChangeDetector = new ApiChangeDetector(this.apiService);
        this.changeDetector = new MyChangeDetector();
        this.changeAnnouncer = new ChangeAnnouncer();

        logger.info('[MetroInfoProvider] MetroInfoProvider initialized.');
    }

    static initialize(metroCore, databaseService, statusEmbedManager) {
        if (!MetroInfoProvider.instance) {
            MetroInfoProvider.instance = new MetroInfoProvider(metroCore, databaseService, statusEmbedManager);
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

    async fetchAndSetEventData() {
        try {
            const events = await this.databaseService.query('SELECT * FROM metro_events WHERE is_active = 0 AND event_date >= CURDATE()');
            if (events && events.length > 0) {
                const upcomingEvents = [];
                for (const event of events) {
                    const eventDetails = await this.databaseService.query('SELECT * FROM event_details WHERE event_id = ?', [event.id]);
                    const stationStatus = await this.databaseService.query('SELECT * FROM event_station_status WHERE event_id = ?', [event.id]);
                    upcomingEvents.push({
                        event,
                        details: eventDetails,
                        stationStatus: stationStatus
                    });
                }
                this.updateData({ events: { upcomingEvents } });
            } else {
                this.updateData({ events: {} });
            }
        } catch (error) {
            logger.error('[MetroInfoProvider] Error fetching event data:', error);
        }
    }

    async updateFromDb(dbData) {
        if (!dbData) return;
        const { lines, stations } = this.data;
        for (const line of dbData.lines) {
            if (!lines[line.id]) {
                lines[line.id] = {};
            }
            Object.assign(lines[line.id], line);
        }
        for (const station of dbData.stations) {
            if (!stations[station.id]) {
                stations[station.id] = {};
            }
            Object.assign(stations[station.id], station);
        }
        this.updateData({ lines, stations });
        await this.fetchAndSetEventData();
    }

    updateFromApi(apiData) {
        const { lines, stations, network_status } = this.data;
        Object.assign(lines, apiData.lineas);
        Object.assign(network_status, apiData.network);
        for (const lineId in apiData.lineas) {
            if (apiData.lineas[lineId].estaciones) {
                for (const station of apiData.lineas[lineId].estaciones) {
                    const stationId = station.id_estacion.toUpperCase();
                    if (!stations[stationId]) {
                        stations[stationId] = {};
                    }
                    station.line_id = lineId;
                    Object.assign(stations[stationId], station);
                }
            }
        }
        this.updateData({ lines, stations, network_status });
    }

    mergeData(apiData, dbData) {
        const mergedData = { ...this.data };
        const apiTimestamp = new Date(apiData.network.timestamp);

        // 1. Index DB data for easy lookup
        const dbLines = {};
        for (const line of dbData.lines) {
            dbLines[line.id] = line;
        }
        const dbStations = {};
        for (const station of dbData.stations) {
            dbStations[station.station_code.toUpperCase()] = station;
        }

        // 2. Merge API data into mergedData, enriching with DB data
        for (const lineId in apiData.lineas) {
            const apiLine = apiData.lineas[lineId];
            const dbLine = dbLines[lineId] || {};

            mergedData.lines[lineId] = { ...dbLine, ...apiLine };

            if (apiLine.estaciones) {
                for (const apiStation of apiLine.estaciones) {
                    const stationId = apiStation.id_estacion.toUpperCase();
                    const dbStation = dbStations[stationId] || {};
                    const dbTimestamp = dbStation.status_data ? new Date(dbStation.status_data.last_updated) : new Date(0);

                    const mergedStation = { ...dbStation, ...apiStation, line_id: lineId };

                    if (apiTimestamp < dbTimestamp) {
                        // DB is newer, so use its status
                        mergedStation.estado = dbStation.estado;
                        mergedStation.descripcion = dbStation.descripcion;
                        mergedStation.descripcion_app = dbStation.descripcion_app;
                        mergedStation.mensaje = dbStation.mensaje;
                    } else {
                        // API is newer or same, so use its status
                        mergedStation.estado = apiStation.estado;
                        mergedStation.descripcion = apiStation.descripcion;
                        mergedStation.descripcion_app = apiStation.descripcion_app;
                        mergedStation.mensaje = apiStation.mensaje;
                    }

                    mergedData.stations[stationId] = mergedStation;
                }
            }
        }

        // 3. Add any stations from DB that were not in the API response
        for (const stationId in dbStations) {
            if (!mergedData.stations[stationId]) {
                mergedData.stations[stationId] = dbStations[stationId];
            }
        }

        // 4. Add any lines from DB that were not in the API response
        for (const lineId in dbLines) {
            if (!mergedData.lines[lineId]) {
                mergedData.lines[lineId] = dbLines[lineId];
            }
        }

        // 5. Set network status from API
        Object.assign(mergedData.network_status, apiData.network);

        return mergedData;
    }

    async compareAndSyncData() {
        const oldData = JSON.parse(JSON.stringify(this.getFullData()));

        const apiData = await this.apiChangeDetector.fetchData();
        const dbData = await this.dbChangeDetector.fetchData();

        const newData = this.mergeData(apiData, dbData);
        const changes = this.changeDetector.detect(oldData, newData);

        if (changes && changes.length > 0) {
            this.updateData(newData);
            await this.changeAnnouncer.generateMessages(changes, newData);
            if (this.statusEmbedManager) {
                await this.statusEmbedManager.updateAllEmbeds(newData);
            }
        }
    }

    getRouteColorName(routeColor) {
        switch (routeColor) {
            case 'V':
                return 'Verde';
            case 'R':
                return 'Roja';
            case 'C':
                return 'Común';
            case 'N':
                return 'Ninguno';
            default:
                return routeColor;
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

        const platforms = station.platforms ? Object.entries(station.platforms).map(([platform, status]) => ({
            platform: parseInt(platform, 10),
            status: status === 1 ? 'active' : 'inactive'
        })) : [];

        const intermodal = this.getIntermodalBuses(station.station_name);

        return {
            name: station.station_name,
            line: station.line_id,
            route: this.getRouteColorName(station.route_color),
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

    getStations() {
        return this.data.stations;
    }

    getStationById(stationId) {
        if (typeof stationId === 'number') {
            return this.data.stations[stationId];
        }
        if (typeof stationId === 'string') {
            const normalizedId = stationId.toLowerCase();
            return Object.values(this.data.stations).find(s => (s.name || s.nombre || s.station_name || '').toLowerCase() === normalizedId);
        }
        return null;
    }

    getIntermodalBuses(stationName) {
        return this.data.intermodal.buses[stationName];
    }
}

module.exports = MetroInfoProvider;
