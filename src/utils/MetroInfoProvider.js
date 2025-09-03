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
        ms.station_id,
        ms.line_id,
        ms.station_code,
        ms.station_name,
        ms.display_name,
        ms.display_order,
        ms.commune,
        ms.address,
        ms.latitude,
        ms.longitude,
        ms.location,
        ms.opened_date,
        ms.last_renovation_date,
        ms.created_at,
        ms.updated_at,
        ms.transports,
        ms.services,
        ms.accessibility as accessibility_text,
        ms.commerce,
        ms.amenities,
        ms.image_url,
        ms.access_details,
        ms.combinacion,
        ms.connections,
        ms.express_state,
        ms.route_color,
        ss.status_id,
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
        jsm.js_code,
        GROUP_CONCAT(CONCAT_WS('|', acs.type, acs.text, acs.status) SEPARATOR ';') as accessibility_statuses
    FROM
        metro_stations ms
    LEFT JOIN
        station_status ss ON ms.station_id = ss.station_id
    LEFT JOIN
        operational_status_types ost ON ss.status_type_id = ost.status_type_id
    LEFT JOIN
        js_status_mapping jsm ON ost.status_type_id = jsm.status_type_id
    LEFT JOIN
        accessibility_status acs ON ms.station_code = acs.station_code
    GROUP BY
        ms.station_id, ss.status_id, ost.status_type_id, jsm.js_code
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
                'serviceType': bus.type,
                'routeOperator': bus.route,
                'destination': bus.destination
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
            commune: station.commune,
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
                    name: line.line_name,
                    displayName: line.display_name,
                    color: line.line_color,
                    app_message: line.app_message,
                    express_status: line.express_status,
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

                let accessibility = station.accessibility_text;
                if (station.accessibility_statuses) {
                    accessibility = station.accessibility_statuses.split(';').map(status => {
                        const [, text] = status.split('|');
                        return text;
                    }).join('\\n');
                }

                stationData[stationId] = {
                    name: station.station_name,
                    code: station.station_code,
                    status: station.is_operational ? '1' : '0',
                    transfer: station.combinacion,
                    description: station.status_description,
                    app_description: station.status_message,
                    message: '',
                    station_id: station.station_id,
                    line_id: station.line_id.toLowerCase(),
                    display_order: station.display_order,
                    commune: station.commune,
                    address: station.address,
                    latitude: station.latitude,
                    longitude: station.longitude,
                    location: station.location ? { type: 'Point', coordinates: [station.longitude, station.latitude] } : null,
                    opened_date: station.opened_date,
                    last_renovation_date: station.last_renovation_date,
                    created_at: station.created_at,
                    updated_at: station.updated_at,
                    display_name: station.display_name || station.station_name,
                    transports: station.transports,
                    services: station.services,
                    accessibility: accessibility,
                    commerce: station.commerce,
                    amenities: station.amenities,
                    image_url: station.image_url,
                    access_details: station.access_details,
                    express_state: station.express_state,
                    route_color: station.route_color,
                    status_data: {
                        station_id: station.station_id,
                        status_type_id: station.status_type_id,
                        status_description: station.status_description,
                        status_message: station.status_message,
                        expected_resolution_time: station.expected_resolution_time,
                        is_planned: station.is_planned,
                        impact_level: station.impact_level,
                        last_updated: station.last_updated,
                        updated_by: station.updated_by,
                        status_name: station.status_name,
                        is_operational: station.is_operational,
                        operational_status_desc: station.operational_status_desc,
                        js_code: station.js_code
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

        const stationStatus = station.status_data.status_message || 'Not available';

        const platforms = station.platforms ? Object.entries(station.platforms).map(([platform, status]) => ({
            platform: parseInt(platform, 10),
            status: status === 1 ? 'active' : 'inactive'
        })) : [];

        const intermodal = this.getIntermodalBuses(station.name);

        const accessibilityDetails = station.accessibility;

        return {
            name: station.name,
            line: station.line_id,
            transfer: station.transfer ? `L${String(station.transfer).replace(/L/g, '')}` : null,
            connections: station.connections || [],
            details: {
                schematics: station.access_details,
                services: station.services,
                accessibility: accessibilityDetails,
                amenities: station.amenities,
                municipality: station.commune,
            },
            platforms: platforms,
            intermodal: intermodal,
            status: {
                code: station.status_data.status_name || 'operational',
                message: stationStatus,
                state: station.status_data.is_operational ? 'operational' : 'closed',
                description: station.status_data.status_description
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
            return Object.values(this.data.stations).find(s => (s.name || '').toLowerCase() === normalizedId);
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
