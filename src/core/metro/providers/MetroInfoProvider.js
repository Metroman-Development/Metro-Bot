const { normalize } = require('../../../utils/stringUtils');

class MetroInfoProvider {
    constructor(metroCore) {
        this.metroCore = metroCore;
    }

    get data() {
        // This getter ensures we always get the latest data.
        // It also provides a default structure if getCurrentData returns nullish value.
        return this.metroCore.getCurrentData() || { stations: {}, lines: {} };
    }

    getStationById(stationId) {
        // The getter ensures this.data and this.data.stations exist.
        return Object.values(this.data.stations).find(s => s.id === stationId);
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
        const stations = this.data.stations;
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
        return Object.values(this.data.stations)
            .filter(station => station.linea === lineKey)
            .sort((a, b) => a.orden - b.orden);
    }

    countStationsBetween(startStation, endStation, line, routeType = null) {
        const allStations = this.data.stations;

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
        const allStations = this.data.stations;

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
        const allStations = this.data.stations;

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
        const allStations = this.data.stations;

        const lineNumber = line.replace('l', '').toLowerCase();
        return Object.values(allStations).some(station =>
            station.line === lineNumber &&
            (station.route?.toLowerCase().includes('roja') ||
                station.route?.toLowerCase().includes('verde'))
        );
    }

    getStationRoute(stationName, line) {
        const allStations = this.data.stations;

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
        const metroData = this.data;
        if (!metroData) {
            return null;
        }

        // metroData itself is the full data object, which contains lines as keys
        const lineInfo = metroData[lineKey];
        if (!lineInfo) {
            return null;
        }

        // The 'lines' property within the data holds additional static info
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

module.exports = MetroInfoProvider;
