const { normalize } = require('./stringUtils');

class MetroInfoProvider {
    constructor() {
        this.metroData = {
            lines: {},
            network_status: {},
            stations: {},
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
            network_status: {},
            stations: {},
            last_updated: null
        };
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
        return this.metroData;
    }

    getStationById(stationId) {
        return Object.values(this.metroData.stations).find(s => s.id === stationId);
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
        const filteredStations = Object.values(stations).filter(s => s.route === route);
        if (!filteredStations || filteredStations.length === 0) {
            return [];
        }
        return filteredStations.map(station => ({
            name: station.original,
            line: station.line,
            route: station.route,
            status: station.status?.message || 'No status information',
        }));
    }

    getStationDetails(stationName) {
        const station = this.getStationById(stationName);
        if (!station) {
            return null;
        }
        return {
            name: station.original,
            line: station.line,
            route: station.route,
            transfer: station.transfer ? `L${station.transfer}` : null,
            details: {
                schematics: station.details.schematics,
                services: station.details.services,
                accessibility: station.details.accessibility,
                amenities: station.details.amenities,
                municipality: station.details.municipality,
            },
            status: {
                code: station.status?.code || '0',
                message: station.status?.message || '',
            },
        };
    }

    getStationsForLine(lineKey) {
        return Object.values(this.metroData.stations)
            .filter(station => station.linea === lineKey)
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
                const stationRoute = station.route.toLowerCase();
                return routeType === 'comun'
                    ? !stationRoute.includes('roja') && !stationRoute.includes('verde')
                    : routeType === 'roja'
                        ? stationRoute.includes('roja')
                        : stationRoute.includes('verde');
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

        if (start.route && end.route) {
            const startRoute = start.route.toLowerCase();
            const endRoute = end.route.toLowerCase();

            if (startRoute.includes('roja') && endRoute.includes('roja')) return 'roja';
            if (startRoute.includes('verde') && endRoute.includes('verde')) return 'verde';
        }

        if (start.route?.toLowerCase().includes('roja') || end.route?.toLowerCase().includes('roja')) {
            return 'roja';
        }
        if (start.route?.toLowerCase().includes('verde') || end.route?.toLowerCase().includes('verde')) {
            return ' verde';
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
                const stationRoute = station.route.toLowerCase();
                return routeType === 'comun'
                    ? !stationRoute.includes('roja') && !stationRoute.includes('verde')
                    : routeType === 'roja'
                        ? stationRoute.includes('roja')
                        : stationRoute.includes('verde');
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
            (station.route?.toLowerCase().includes('roja') ||
                station.route?.toLowerCase().includes('verde'))
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

        const route = station.route?.toLowerCase();
        if (route?.includes('roja')) return 'roja';
        if (route?.includes('verde')) return 'verde';
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
                'N° estaciones': lineInfo.estaciones?.length || lineDataFromJSON?.['N° estaciones'] || 0,
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
