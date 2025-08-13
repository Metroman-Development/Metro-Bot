const path = require('path');
const fs = require('fs');
const { normalize } = require('./stringUtils');
// const { getCachedMetroData } = require('../events/metroDataHandler');
const { getClient } = require('./clientManager');
const logger = require('../events/logger');

let cachedStationData = null;

function loadStationData() {
    const client = getClient(); // Get the client object

    try {
        const stationsPath = path.join(__dirname, '../data/stations.json');
        const detailsPath = path.join(__dirname, '../data/stationsData.json');

        // Check if files exist before reading
        if (!fs.existsSync(stationsPath)) throw new Error('stations.json not found.');
        if (!fs.existsSync(detailsPath)) throw new Error('stationsData.json not found.');

        // Read and parse JSON files
        const rawStations = JSON.parse(fs.readFileSync(stationsPath, 'utf-8'));
        const rawDetails = JSON.parse(fs.readFileSync(detailsPath, 'utf-8'));
        const metroData = null; // aida: getCachedMetroData is not available

        // Check if metroData is valid
        if (!metroData || typeof metroData !== 'object') {
            throw new Error('Metro data is invalid or not loaded.');
        }

        // Initialize cachedStationData
        cachedStationData = {
            stations: {},
            normalizedMap: new Map(),
            codeMap: new Map(),
            routeMap: new Map(),
        };

        // Process all lines and stations from metroData
        Object.entries(metroData).forEach(([lineKey, lineData]) => {
            const lineNumber = lineKey.match(/l(\d+[a-z]*)/i)?.[1]?.toLowerCase();
            if (!lineNumber) return;

            // Check if lineData.estaciones exists and is an array
            if (!Array.isArray(lineData.estaciones)) {
                logger.warn(client, `Line ${lineKey} has no stations or estaciones is not an array.`);
                return;
            }

            lineData.estaciones.forEach(metroStation => {
                const stationName = metroStation.nombre; // Use exact name from metroData

                console.log(stationName);
                const normalizedName = normalize(stationName);

                // Get static data from stations.json
                const staticData = rawStations[lineKey]?.[stationName] || {};
                const route = staticData.ruta || 'Estándar'; // Fallback to 'Estándar' if no route is specified

                // Get details from stationsData.json
                const detailsEntry = rawDetails.stationsData?.[normalizedName.toLowerCase()] || [];
                const schematics = rawDetails.stationsSchematics?.[normalizedName.toLowerCase()] || [];

                // Build unified station object
                const station = {
                    original: stationName,
                    normalized: normalizedName,
                    line: lineNumber,
                    code: metroStation.codigo,

                   transfer: metroStation.combinacion?.match(/l(\d+[a-z]*)/i)?.[1] || null,
                    route: route,
                    details: {
                        schematics: schematics,
                        services: detailsEntry[1]?.split(', ') || [],
                        accessibility: detailsEntry[2] || 'Sin información',
                        amenities: detailsEntry[4]?.split(', ') || [],
                        municipality: detailsEntry[6] || 'Desconocido',
                    },
                    status: {
                        code: metroStation.estado || '0',
                        description: metroStation.descripcion_app || 'Estado desconocido',
                        message: metroStation.mensaje || '',
                    },
                };

                // Add to data structures
                cachedStationData.stations[stationName] = station;
                cachedStationData.normalizedMap.set(normalizedName, stationName);

                // Map station code if available
                if (metroStation.codigo) {
                    cachedStationData.codeMap.set(metroStation.codigo.toLowerCase(), stationName);
                }

                // Add to route map
                if (!cachedStationData.routeMap.has(route)) {
                    cachedStationData.routeMap.set(route, new Set());
                }
                cachedStationData.routeMap.get(route).add(stationName);
            });
        });

        logger.info(client, `Loaded ${Object.keys(cachedStationData.stations).length} stations with unified data`);
        return true;
    } catch (error) {
        logger.error(client, `Data unification failed: ${error.message}`);
        return false;
    }
}

// Unified access methods
function getStation(identifier) {
    const client = getClient();
    if (!cachedStationData) {
        logger.warn(client, 'Station data is not loaded. Call loadStationData() first.');
        return null;
    }


    logger.info(identifier) ;

    // Try direct match first
    if (cachedStationData.stations[identifier]) return cachedStationData.stations[identifier];

    console.log("Búsqueda Extensiva");

    // Try station code lookup
    const byCode = cachedStationData.codeMap.get(identifier.toLowerCase());
    if (byCode) return cachedStationData.stations[byCode];

    // Try normalized name lookup
    const normalized = normalize(identifier);
    const byNormalized = cachedStationData.normalizedMap.get(normalized);
    return cachedStationData.stations[byNormalized];
}

function getStationsByRoute(route) {
    if (!cachedStationData) {
        logger.warn(getClient(), 'Station data is not loaded. Call loadStationData() first.');
        return [];
    }
    return Array.from(cachedStationData.routeMap.get(route) || []).map(name =>
        cachedStationData.stations[name]
    );
}

function getAllStations() {
    if (!cachedStationData) {
        logger.warn(getClient(), 'Station data is not loaded. Call loadStationData() first.');
        return {};
    }
    return cachedStationData.stations;
}

module.exports = {
    loadStationData,
    getStation,
    getStationsByRoute,
    getAllStations,
};
