const { getAllStations, getStation, getStationsByRoute, loadStationData } = require('./dataUtils');
const { normalize } = require('./stringUtils');
const logger = require('../events/logger');
const stationsData = require('../data/stations.json'); // Load stations data

// Existing functions remain unchanged
function findStationInfo(identifier) {
    const station = getStation(identifier);
    if (!station) {
        logger.warn(`Station not found: ${identifier}`);
        return null;
    }
    return station;
}

function getTransferInfo(stationName) {
    const station = getStation(stationName);
    if (!station) {
        logger.warn(`Station not found: ${stationName}`);
        return null;
    }
    return {
        station: station.original,
        line: station.line,
        transfer: station.transfer ? `L${station.transfer}` : null,
    };
}

function getStationsOnRoute(route) {
    const stations = getStationsByRoute(route);
    if (!stations || stations.length === 0) {
        logger.warn(`No stations found for route: ${route}`);
        return [];
    }
    return stations.map(station => ({
        name: station.original,
        line: station.line,
        route: station.route,
        status: station.status?.description || 'No status information',
    }));
}

function getStationDetails(stationName) {
    const station = getStation(stationName);
    if (!station) {
        logger.warn(`Station not found: ${stationName}`);
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
            description: station.status?.description || 'No status information',
            message: station.status?.message || '',
        },
    };
}

// New function to format station ranges
function formatStationRanges(stationNames) {
    if (!stationNames?.length) return '';

    // Get all stations data and sort by their line order
    const sortedStations = stationNames
        .map(name => stationsData.find(s => s.nombre === name))
        .filter(Boolean)
        .sort((a, b) => {
            // Sort by line first, then by station order
            if (a.linea !== b.linea) return a.linea.localeCompare(b.linea);
            return a.orden - b.orden;
        })
        .map(s => s.nombre);

    if (sortedStations.length === 0) return '';

    let result = [];
    let start = sortedStations[0];
    let prev = sortedStations[0];

    for (let i = 1; i < sortedStations.length; i++) {
        const current = sortedStations[i];
        const currentStation = stationsData.find(s => s.nombre === current);
        const prevStation = stationsData.find(s => s.nombre === prev);

        // Check if stations are consecutive on the same line
        if (currentStation?.linea === prevStation?.linea &&
            currentStation?.orden === prevStation?.orden + 1) {
            prev = current;
        } else {
            if (start === prev) {
                result.push(start);
            } else {
                result.push(`${start} a ${prev}`);
            }
            start = current;
            prev = current;
        }
    }

    // Add the last range
    if (start === prev) {
        result.push(start);
    } else {
        result.push(`${start} a ${prev}`);
    }

    return result.join(', ');
}

// New function to get line stations in order
function getStationsForLine(lineKey) {
    return stationsData
        .filter(station => station.linea === lineKey)
        .sort((a, b) => a.orden - b.orden);
}



/**
 * Counts stations between two points on the same line, with optional route filtering
 * @param {string} startStation - Starting station name
 * @param {string} endStation - Ending station name
 * @param {string} line - Line identifier (e.g., 'l1')
 * @param {string|null} routeType - 'red', 'green', 'common', or null for all stations
 * @returns {number|null} Number of stations or null if invalid
 */
function countStationsBetween(startStation, endStation, line, routeType = null) {
    const allStations = getAllStations();
    if (!allStations) return null;

    // Normalize line format (handle both 'l1' and '1' formats)
    const lineNumber = line.replace('l', '').toLowerCase();

    // Filter stations for the specified line
    let lineStations = Object.values(allStations)
        .filter(station => station.line === lineNumber)
        .sort((a, b) => a.code.localeCompare(b.code));

    // Apply route filter if specified
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

    // Find indexes of start and end stations
    const normalizedStart = normalize(startStation);
    const normalizedEnd = normalize(endStation);

    const startIndex = lineStations.findIndex(s =>
        normalize(s.original) === normalizedStart);
    const endIndex = lineStations.findIndex(s =>
        normalize(s.original) === normalizedEnd);

    // Validate indexes
    if (startIndex === -1 || endIndex === -1) return null;

    return Math.abs(endIndex - startIndex) + 1;
}

/**
 * Determines the dominant route type between two stations
 * @param {string} startStation - Starting station name
 * @param {string} endStation - Ending station name
 * @param {string} line - Line identifier
 * @returns {string} 'red', 'green', or 'common'
 */
function getDominantRoute(startStation, endStation, line) {
    const allStations = getAllStations();
    if (!allStations) return 'comun';

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

    // If both stations share the same route, use that
    if (start.route && end.route) {
        const startRoute = start.route.toLowerCase();
        const endRoute = end.route.toLowerCase();

        if (startRoute.includes('roja') && endRoute.includes('roja')) return 'roja';
        if (startRoute.includes('verde') && endRoute.includes('verde')) return 'verde';
    }

    // If either station is on a specific route, use that
    if (start.route?.toLowerCase().includes('roja') || end.route?.toLowerCase().includes('roja')) {
        return 'roja';
    }
    if (start.route?.toLowerCase().includes('verde') || end.route?.toLowerCase().includes('verde')) {
        return ' verde';
    }

    return 'comun';
}

/**
 * Gets all stations between two points, optionally filtered by route
 * @param {string} startStation - Starting station name
 * @param {string} endStation - Ending station name
 * @param {string} line - Line identifier
 * @param {string|null} routeType - 'red', 'green', 'common', or null
 * @returns {Array|null} Array of station objects or null if invalid
 */
function getStationsBetween(startStation, endStation, line, routeType = null) {
    const allStations = getAllStations();
    if (!allStations) return null;

    const lineNumber = line.replace('l', '').toLowerCase();
    const normalizedStart = normalize(startStation);
    const normalizedEnd = normalize(endStation);

    // Get all stations on the line
    let lineStations = Object.values(allStations)
        .filter(station => station.line === lineNumber)
        .sort((a, b) => a.code.localeCompare(b.code));

    // Apply route filter if specified
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

    // Find indexes of start and end stations
    const startIndex = lineStations.findIndex(s =>
        normalize(s.original) === normalizedStart);
    const endIndex = lineStations.findIndex(s =>
        normalize(s.original) === normalizedEnd);

    if (startIndex === -1 || endIndex === -1) return null;

    // Return stations between the indexes (inclusive)
    const start = Math.min(startIndex, endIndex);
    const end = Math.max(startIndex, endIndex);
    return lineStations.slice(start, end + 1);
}

/**
 * Checks if a line has express routes
 * @param {string} line - Line identifier
 * @returns {boolean} True if line has express routes
 */
function hasExpressRoutes(line) {
    const allStations = getAllStations();
    if (!allStations) return false;

    const lineNumber = line.replace('l', '').toLowerCase();
    return Object.values(allStations).some(station =>
        station.line === lineNumber &&
        (station.route?.toLowerCase().includes('roja') ||
         station.route?.toLowerCase().includes('verde'))
    );
}

/**
 * Gets the route type for a specific station
 * @param {string} stationName - Station name
 * @param {string} line - Line identifier
 * @returns {string} 'red', 'green', or 'common'
 */
function getStationRoute(stationName, line) {
    const allStations = getAllStations();
    if (!allStations) return 'comun';

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

module.exports = {

};

module.exports = {
    findStationInfo,
    getTransferInfo,
    getStationsOnRoute,
    getStationDetails,
    formatStationRanges,
    getStationsForLine,
    countStationsBetween,

    getDominantRoute,

    getStationsBetween,

    hasExpressRoutes,

    getStationRoute
};