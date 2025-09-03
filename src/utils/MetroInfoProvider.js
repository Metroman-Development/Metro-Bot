const logger = require('../events/logger');
const metroConfig = require('../config/metro/metroConfig');
const { diff } = require('deep-diff');
const DataManager = require('../core/metro/core/services/DataManager');
const DbChangeDetector = require('../core/metro/core/services/changeDetectors/DbChangeDetector');
const ApiChangeDetector = require('../core/metro/core/services/changeDetectors/ApiChangeDetector');
const MyChangeDetector = require('../core/status/ChangeDetector');
const ChangeAnnouncer = require('../core/status/ChangeAnnouncer');
const StatusEmbedManager = require('../core/status/StatusEmbedManager');
const { normalizeStationData } = require('./stationUtils.js');

const STATIONS_QUERY = `
                SELECT
                    ms.station_code,
                    ms.station_name,
                    ms.display_name,
                    ms.line_id,
                    ms.commune,
                    ms.transports,
                    ms.services,
                    ms.commerce,
                    ms.amenities,
                    ms.image_url,
                    ms.accessibility,
                    ms.access_details,
                    ms.opened_date,
                    ms.last_renovation_date,
                    ms.combinacion,
                    ms.connections,
                    ss.status_description,
                    ss.status_message,
                    ss.is_planned,
                    ss.impact_level,
                    ost.status_name as status_code,
                    ost.is_operational
                FROM
                    metro_stations ms
                LEFT JOIN
                    station_status ss ON ms.station_id = ss.station_id
                LEFT JOIN
                    operational_status_types ost ON ss.status_type_id = ost.status_type_id
            `;

class MetroInfoProvider {
    static instance = null;

    constructor(databaseService, statusEmbedManager) {
        if (!databaseService) {
            throw new Error("MetroInfoProvider requires a databaseService instance.");
        }
        this.databaseService = databaseService;
        this.statusEmbedManager = statusEmbedManager || null;
        this.config = metroConfig;
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
            last_updated: null,
            lineFleet: [],
            statusOverrides: [],
            scheduledStatusOverrides: [],
            jsStatusMapping: {},
            operationalStatusTypes: [],
            changeHistory: [],
            systemInfo: {}
        };
        this.isInitialized = true;
        this.source = 'database';
    }

    async loadIntermodalFromDb() {
        try {
            const stations = await this.databaseService.query("SELECT * FROM intermodal_stations");
            const buses = await this.databaseService.query("SELECT * FROM intermodal_buses");
            return this._transformIntermodal(stations, buses);
        } catch (err) {
            throw err;
        }
    }

    _transformIntermodal(stations, buses) {
        const busMap = buses.reduce((acc, bus) => {
            if (!acc[bus.station_id]) {
                acc[bus.station_id] = [];
            }
            acc[bus.station_id].push({
                'Tipo Servicio': bus.type,
                'Recorrido/Operador': bus.route,
                'Destino': bus.destination
            });
            return acc;
        }, {});

        return stations.reduce((acc, station) => {
          const normalizedName = this._normalizeName(station.name);
          acc[normalizedName] = {
            id: normalizedName,
            services: JSON.parse(station.services),
            buses: busMap[station.id] || [],
            location: station.location,
            comuna: station.commune,
            inauguration: station.inauguration,
            platforms: station.platforms,
            operator: station.operator
          };
          return acc;
        }, {});
    }

    _normalizeName(name) {
        return name.toLowerCase().replace(/\s+/g, '_');
    }

    async loadMetroFromDb() {
        try {
            const rows = await this.databaseService.query("SELECT * FROM system_info LIMIT 1");
            return this._transformMetro(rows[0]);
        } catch (err) {
            // Rethrow the error to be handled by the caller
            throw err;
        }
    }

    _transformMetro(data){
        if (!data) return {};
        return {
            name: data.name,
            system: data.system,
            inauguration: data.inauguration,
            technicalCharacteristics: {
                length: data.length,
                stations: data.stations,
                trackGauge: data.track_gauge,
                electrification: data.electrification,
                maxSpeed: data.max_speed
            },
            operation: {
                status: data.status,
                lines: data.lines,
                cars: data.cars,
                passengers: data.passengers,
                fleet: data.fleet,
                averageSpeed: data.average_speed,
                operator: data.operator
            },
            mapUrl: data.map_url
        };
    }

    async loadLinesFromDb() {
        try {
            const lines = await this.databaseService.query('SELECT * FROM metro_lines');

            const lineData = {};
            for (const line of lines) {
                const lineId = line.line_id.toLowerCase();
                lineData[lineId] = {
                    id: lineId,
                    displayName: line.line_name,
                    color: line.line_color,
                    status: {
                        message: line.status_message,
                        code: line.status_code
                    },
                };
            }

            return lineData;
        } catch (error) {
            console.error('Error loading line data from database:', error);
            throw error;
        }
    }

    async loadStationsFromDb() {
        try {
            const stations = await this.databaseService.query(STATIONS_QUERY);

            const stationData = {};
            for (const station of stations) {
                const stationId = station.station_code.toUpperCase();
                stationData[stationId] = {
                    id: stationId,
                    name: station.station_name,
                    displayName: station.display_name || station.station_name,
                    line: station.line_id.toLowerCase(),
                    commune: station.commune,
                    transports: station.transports,
                    services: station.services,
                    commerce: station.commerce,
                    amenities: station.amenities,
                    image: station.image_url,
                    accessibility: station.accessibility,
                    accessDetails: station.access_details,
                    openedDate: station.opened_date,
                    lastRenovationDate: station.last_renovation_date,
                    combinacion: station.combinacion,
                    connections: station.connections,
                    status: {
                        code: station.status_code || 'operational',
                        description: station.status_description,
                        message: station.status_message,
                        isPlanned: station.is_planned,
                        impactLevel: station.impact_level,
                        isOperational: station.is_operational !== 0,
                    }
                };
            }

            return stationData;
        } catch (error) {
            console.error('Error loading station data from database:', error);
            throw error;
        }
    }

    static initialize(databaseService, statusEmbedManager) {
        if (!MetroInfoProvider.instance) {
            MetroInfoProvider.instance = new MetroInfoProvider(databaseService, statusEmbedManager);
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

    async updateFromDb() {
        const [lines, stations] = await Promise.all([
            this.loadLinesFromDb(),
            this.loadStationsFromDb(),
        ]);
        this.updateData({ lines, stations });
        await this.fetchAndSetEventData();
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
        const stationStatus = station.status_message || 'No disponible';

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
                code: station.status_name || '0',
                message: stationStatus,
                nombre: station.station_name,
                codigo: station.station_code,
                estado: station.is_operational ? 'operational' : 'closed',
                descripcion: station.status_description,
                descripcion_app: station.status_message,
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

    async compareAndSyncData(dbData) {
        // For now, just update from db
        await this.updateFromDb(dbData);
    }

    getConfig() {
        return this.config;
    }
}

module.exports = { MetroInfoProvider, STATIONS_QUERY };
