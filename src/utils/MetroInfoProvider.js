const logger = require('../events/logger');
const { diff } = require('deep-diff');
const DataManager = require('../core/metro/core/services/DataManager');
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
        this.isInitialized = false;

        this.dataManager = new DataManager(metroCore, { dbService: databaseService }, null);
        this.dbChangeDetector = new DbChangeDetector(databaseService);
        this.dataManagerChangeDetector = new ApiChangeDetector(this.dataManager);
        this.changeDetector = new MyChangeDetector();
        this.changeAnnouncer = new ChangeAnnouncer();

        this.#fetchDataFromDB().then(() => {
            this.isInitialized = true;
            logger.info('[MetroInfoProvider] MetroInfoProvider initialized and data loaded from DB.');
        }).catch(error => {
            logger.error('[MetroInfoProvider] Failed to initialize MetroInfoProvider:', error);
        });
    }

    async #fetchDataFromDB() {
        logger.info('[MetroInfoProvider] Fetching data from database...');
        try {
            const linesQuery = `
                SELECT
                    ml.*,
                    ls.status_description,
                    ost.status_name,
                    ost.is_operational
                FROM metro_lines ml
                LEFT JOIN line_status ls ON ml.line_id = ls.line_id
                LEFT JOIN operational_status_types ost ON ls.status_type_id = ost.status_type_id
            `;
            const stationsQuery = `
                SELECT
                    ms.*,
                    ss.status_description,
                    ost.status_name,
                    ost.is_operational
                FROM metro_stations ms
                LEFT JOIN station_status ss ON ms.station_id = ss.station_id
                LEFT JOIN operational_status_types ost ON ss.status_type_id = ost.status_type_id
            `;

            const [linesData, stationsData] = await Promise.all([
                this.databaseService.query(linesQuery),
                this.databaseService.query(stationsQuery)
            ]);

            const lines = {};
            for (const line of linesData) {
                lines[line.line_id] = line;
            }

            const stations = {};
            for (const station of stationsData) {
                const stationName = (station.station_name || '').toLowerCase();
                // Parse connections if they are in JSON string format
                if (typeof station.connections === 'string') {
                    try {
                        station.connections = JSON.parse(station.connections);
                    } catch (e) {
                        logger.warn(`[MetroInfoProvider] Could not parse connections JSON for station ${station.station_code}: ${station.connections}`);
                        station.connections = [];
                    }
                }
                stations[stationName] = station;
            }

            this.updateData({ lines, stations, last_updated: new Date() });
            logger.info(`[MetroInfoProvider] Successfully fetched and processed data for ${linesData.length} lines and ${stationsData.length} stations.`);
        } catch (error) {
            logger.error('[MetroInfoProvider] Error fetching data from DB:', error);
            throw error;
        }
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
        if (dbData) {
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
        } else {
            const [lines, stations] = await Promise.all([
                this.databaseService.getLinesWithStatus(),
                this.databaseService.getStationsWithStatus()
            ]);

            const linesById = {};
            for (const line of lines) {
                linesById[line.line_id] = line;
            }

            const stationsById = {};
            for (const station of stations) {
                stationsById[station.station_id] = station;
            }

            this.updateData({ lines: linesById, stations: stationsById });
        }

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
}

module.exports = MetroInfoProvider;
