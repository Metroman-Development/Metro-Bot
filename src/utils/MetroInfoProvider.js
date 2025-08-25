const { normalize } = require('./stringUtils');

class MetroInfoProvider {
    constructor() {
        this.metroData = {
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
    }

    static getInstance() {
        if (!MetroInfoProvider.instance) {
            MetroInfoProvider.instance = new MetroInfoProvider();
        }
        return MetroInfoProvider.instance;
    }

    /**
     * Updates the data in the provider.
     * @param {object} newData - The new, full, processed metro data object.
     */
    updateData(newData) {
        this.metroData = newData || {
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

        if (newData && newData.lines) {
            console.log("Updated metro data with: ", newData.lines);
        }
    }

    /**
     * Updates the data from the API.
     * @param {object} apiData - The data fetched from the API.
     */
    updateFromApi(apiData) {
        const currentData = JSON.parse(JSON.stringify(this.getFullData()));
        const apiLastChange = new Date(apiData.lastSuccessfulFetch);
        const dbLastChange = new Date(currentData.last_updated);

        if (apiLastChange > dbLastChange) {
            currentData.lines = apiData.lineas;
            currentData.network_status = apiData.network;

            // Store stations in memory
            for (const lineId in apiData.lineas) {
                if (apiData.lineas[lineId].estaciones) {
                    for (const station of apiData.lineas[lineId].estaciones) {
                        const stationId = station.id_estacion.toUpperCase();
                        if (!currentData.stations[stationId]) {
                            currentData.stations[stationId] = {};
                        }
                        Object.assign(currentData.stations[stationId], station);
                    }
                    currentData.lines[lineId].stations = apiData.lineas[lineId].estaciones.map(s => s.id_estacion);
                    delete currentData.lines[lineId].estaciones;
                }
            }
            this.updateData(currentData);
        }
    }

    /**
     * Updates the data from the database.
     * @param {object} dbData - The data fetched from the database.
     */
    updateFromDb(dbData) {
        const currentData = JSON.parse(JSON.stringify(this.getFullData()));

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

        this.updateData(currentData);
    }

    /**
     * Gets all line data.
     * @returns {object} A map of line data.
     */
    getLines() {
        return this.metroData.lines;
    }

    getFutureLines() {
        return this.metroData.futureLines;
    }

    getTrainInfo(modelId) {
        return this.metroData.trains[modelId];
    }

    getAccessibilityStatus(stationCode) {
        return this.metroData.accessibility[stationCode];
    }

    getIntermodalStations() {
        return this.metroData.intermodal.stations;
    }

    getIntermodalBuses(stationName) {
        return this.metroData.intermodal.buses[stationName];
    }

    /**
     * Gets all station data.
     * @returns {object} A map of station data.
     */
    getStations() {
        return this.metroData.stations;
    }

    /**
     * Gets the full dataset.
     * @returns {object} The full metro data object.
     */
    getFullData() {
        const data = { ...this.metroData };

        if (!data.network_status) {
            data.network_status = { status: 'unknown' };
        }

        return data;
    }

    getStationById(stationId) {
        if (typeof stationId === 'number') {
            return this.metroData.stations[stationId];
        }
        if (typeof stationId === 'string') {
            const normalizedId = normalize(stationId);
            return Object.values(this.metroData.stations).find(s => normalize(s.station_name) === normalizedId);
        }
        return null;
    }

    findStationInfo(identifier) {
        return this.getStationById(identifier);
    }

    getTransferInfo(stationName) {
        const station = this.getStationById(stationName);
        if (!station) {
            return null;
        }
        return {
            station: station.original,
            line: station.line,
            transfer: station.transfer ? `L${station.transfer}` : null,
        };
    }

    getStationsOnRoute(route) {
        const stations = this.metroData.stations;
        const filteredStations = Object.values(stations).filter(s => s.route_color === route);
        if (!filteredStations || filteredStations.length === 0) {
            return [];
        }
        return filteredStations.map(station => ({
            name: station.station_name,
            line: station.line_id,
            route: station.route_color,
            status: station.status?.message || 'No status information',
        }));
    }

    getStationDetails(stationName) {
        const station = this.getStationById(stationName);
        if (!station) {
            return null;
        }

        const line = this.metroData.lines[station.line_id];
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

    getStationsForLine(lineKey) {
        return Object.values(this.metroData.stations)
            .filter(station => station.line === lineKey)
            .sort((a, b) => a.orden - b.orden);
    }

    countStationsBetween(startStation, endStation, line, routeType = null) {
        const allStations = this.metroData.stations;

        const lineNumber = line.replace('l', '').toLowerCase();

        let lineStations = Object.values(allStations)
            .filter(station => station.line === lineNumber)
            .sort((a, b) => a.code.localeCompare(b.code));

        if (routeType) {
            lineStations = lineStations.filter(station => {
                const stationRoute = station.route_color.toLowerCase();
                return routeType === 'comun'
                    ? stationRoute === 'c'
                    : routeType === 'roja'
                        ? stationRoute === 'r'
                        : stationRoute === 'v';
            });
        }

        const normalizedStart = normalize(startStation);
        const normalizedEnd = normalize(endStation);

        const startIndex = lineStations.findIndex(s =>
            normalize(s.original) === normalizedStart);
        const endIndex = lineStations.findIndex(s =>
            normalize(s.original) === normalizedEnd);

        if (startIndex === -1 || endIndex === -1) return null;

        return Math.abs(endIndex - startIndex) + 1;
    }

    getDominantRoute(startStation, endStation, line) {
        const allStations = this.metroData.stations;

        const lineNumber = line.replace('l', '').toLowerCase();
        const normalizedStart = normalize(startStation);
        const normalizedEnd = normalize(endStation);

        const start = Object.values(allStations).find(s =>
            normalize(s.original) === normalizedStart &&
            s.line === lineNumber);
        const end = Object.values(allStations).find(s =>
            normalize(s.original) === normalizedEnd &&
            s.line === lineNumber);

        if (!start || !end) return 'comun';

        if (start.route_color && end.route_color) {
            const startRoute = start.route_color.toLowerCase();
            const endRoute = end.route_color.toLowerCase();

            if (startRoute === 'r' && endRoute === 'r') return 'roja';
            if (startRoute === 'v' && endRoute === 'v') return 'verde';
        }

        if (start.route_color?.toLowerCase() === 'r' || end.route_color?.toLowerCase() === 'r') {
            return 'roja';
        }
        if (start.route_color?.toLowerCase() === 'v' || end.route_color?.toLowerCase() === 'v') {
            return 'verde';
        }

        return 'comun';
    }

    getStationsBetween(startStation, endStation, line, routeType = null) {
        const allStations = this.metroData.stations;

        const lineNumber = line.replace('l', '').toLowerCase();
        const normalizedStart = normalize(startStation);
        const normalizedEnd = normalize(endStation);

        let lineStations = Object.values(allStations)
            .filter(station => station.line === lineNumber)
            .sort((a, b) => a.code.localeCompare(b.code));

        if (routeType) {
            lineStations = lineStations.filter(station => {
                const stationRoute = station.route_color.toLowerCase();
                return routeType === 'comun'
                    ? stationRoute === 'c'
                    : routeType === 'roja'
                        ? stationRoute === 'r'
                        : stationRoute === 'v';
            });
        }

        const startIndex = lineStations.findIndex(s =>
            normalize(s.original) === normalizedStart);
        const endIndex = lineStations.findIndex(s =>
            normalize(s.original) === normalizedEnd);

        if (startIndex === -1 || endIndex === -1) return null;

        const start = Math.min(startIndex, endIndex);
        const end = Math.max(startIndex, endIndex);
        return lineStations.slice(start, end + 1);
    }

    hasExpressRoutes(line) {
        const allStations = this.metroData.stations;

        const lineNumber = line.replace('l', '').toLowerCase();
        return Object.values(allStations).some(station =>
            station.line === lineNumber &&
            (station.route_color === 'R' || station.route_color === 'V')
        );
    }

    getStationRoute(stationName, line) {
        const allStations = this.metroData.stations;

        const lineNumber = line.replace('l', '').toLowerCase();
        const normalizedName = normalize(stationName);

        const station = Object.values(allStations).find(s =>
            normalize(s.original) === normalizedName &&
            s.line === lineNumber);

        if (!station) return 'comun';

        const route = station.route_color?.toLowerCase();
        if (route === 'r') return 'roja';
        if (route === 'v') return 'verde';
        return 'comun';
    }

    hasExpressRoute(lineInput) {
        const normalized = String(lineInput || '')
            .toLowerCase()
            .replace(/[^0-9a-z]|linea?/gi, '');
        return new Set(['l2', 'l4', 'l5']).has(`l${normalized}`) || new Set(['l2', 'l4', 'l5']).has(normalized);
    }

    getLineData(lineKey) {
        const metroData = this.metroData;
        if (!metroData) {
            return null;
        }

        const lineInfo = metroData.lines[lineKey];
        if (!lineInfo) {
            return null;
        }

        const lineDataFromJSON = metroData.lines?.[lineKey];
        return {
            nombre: `Línea ${lineKey.replace('l', '')}`,
            key: lineKey,
            data: {
                Estreno: lineInfo.Estreno || lineDataFromJSON?.Estreno || 'No disponible',
                Longitud: lineInfo.Longitud || lineDataFromJSON?.Longitud || 'No disponible',
                'N° estaciones': lineInfo.stations?.length || lineDataFromJSON?.['N° estaciones'] || 0,
                Comunas: lineInfo.Comunas || lineDataFromJSON?.Comunas || ['No disponible'],
                Electrificación: lineInfo.Electrificación || lineDataFromJSON?.Electrificación || 'No disponible',
                Flota: lineInfo.Flota || lineDataFromJSON?.Flota || ['No disponible'],
                Características: lineInfo.Características || lineDataFromJSON?.Características || 'No disponible'
            },
            mensaje: lineInfo.mensaje || '',
            mensaje_app: lineInfo.mensaje_app || 'No disponible',
            color: '#5865F2' // Default color
        };
    }
}

module.exports = MetroInfoProvider.getInstance();
