// modules/metro/queries/express.js
const { normalize } = require('../../../utils/stringUtils.js');
const linesData = {};
const stationsData = {};

const EXPRESS_LINES = new Set(['l2', 'l4', 'l5']);
const EXPRESS_ROUTE_TYPES = ['comun', 'verde', 'roja'];

function normalizeRoute(route) {
    return route?.normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/ruta\s*/g, '') || '';
}

function resolveRouteCombination(selectedRoute, currentRoute) {
    const normalizedCurrent = normalizeRoute(currentRoute);
    const isComun = normalizedCurrent.includes('comun');
    const isVerde = normalizedCurrent.includes('verde');
    const isRoja = normalizedCurrent.includes('roja');

    switch(selectedRoute) {
        case 'all': return 'all';
        case 'comun':
            if (isVerde) return 'comun+verde';
            if (isRoja) return 'comun+roja';
            return isComun ? 'all' : 'comun';
        case 'verde':
            if (isRoja) return 'all';
            return isComun ? 'comun+verde' : 'verde';
        case 'roja':
            if (isVerde) return 'all';
            return isComun ? 'comun+roja' : 'roja';
        default: return selectedRoute;
    }
}

module.exports = (core) => ({
    // Express line detection
    isExpressLine: (lineId) => EXPRESS_LINES.has(lineId.toLowerCase()),

    // Route-based station filtering
    getStationsByRoute: (lineId, routeFilter) => {
        const normalizedFilter = normalizeRoute(routeFilter);
        const lineStations = stationsData[lineId] || {};

        if (normalizedFilter === 'all') return Object.keys(lineStations);

        return Object.entries(lineStations)
            .filter(([_, data]) => {
                const stationRoute = normalizeRoute(data.ruta);
                if (normalizedFilter.includes('+')) {
                    return normalizedFilter.split('+')
                        .some(r => stationRoute.includes(r));
                }
                return stationRoute.includes(normalizedFilter);
            })
            .map(([name]) => name);
    },

    // Enhanced station counting with filters
    countStationsBetween: (startStation, endStation, lineId, filters = {}) => {
        const line = core.getLine(lineId);
        if (!line) return null;

        const stations = line.stations
            .filter(station => applyStationFilters(station, filters))
            .map(s => s.code);

        const startIndex = stations.indexOf(startStation);
        const endIndex = stations.indexOf(endStation);

        if (startIndex === -1 || endIndex === -1) return null;
        return Math.abs(endIndex - startIndex) + 1;
    },

    // Route combination resolver
    resolveRouteCombination,

    // Express route status checker
    getExpressRouteStatus: (lineId) => {
        if (!this.isExpressLine(lineId)) return 'not_express';
        const line = core.getLine(lineId);
        return line.expressActive ? 'active' : 'inactive';
    }
});

function applyStationFilters(station, filters) {
    return Object.entries(filters).every(([key, value]) => {
        switch(key) {
            case 'status':
                return station.status === value;
            case 'routeType':
                return normalizeRoute(station.route).includes(normalizeRoute(value));
            case 'accessibility':
                return station.details.accessibility === value;
            case 'express':
                return value ? station.route.includes('express') : true;
            default:
                return true;
        }
    });
}