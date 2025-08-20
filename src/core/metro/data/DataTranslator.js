const fs = require('fs').promises;
const path = require('path');

function normalizeStationName(name) {
    if (!name) return '';
    return name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\./g, '')
        .replace(/l\d[ab]?$/, '')
        .trim();
}

async function translateApiData(apiData) {
    try {
        const stationsDataPath = path.join(__dirname, '..', '..', '..', 'data', 'stationsData.json');
        const accessibilityCachePath = path.join(__dirname, '..', '..', '..', 'data', 'accessibilityCache.json');

        const stationsDataFile = await fs.readFile(stationsDataPath, 'utf8');
        const accessibilityCacheFile = await fs.readFile(accessibilityCachePath, 'utf8');

        const stationsData = JSON.parse(stationsDataFile).stationsData;
        const accessibilityCache = JSON.parse(accessibilityCacheFile);

        const unifiedStations = {};
        const unifiedLines = {};

        const stationsDataLookup = {};
        for (const key in stationsData) {
            stationsDataLookup[normalizeStationName(key)] = stationsData[key];
        }

        for (const lineId in apiData.lineas) {
            const line = apiData.lineas[lineId];
            unifiedLines[lineId] = {
                id: lineId,
                name: line.nombre || `Línea ${lineId.toUpperCase()}`,
                status: line.estado === '1' ? 'operational' : 'closed',
                message: line.mensaje_app,
                stations: []
            };

            for (const station of line.estaciones) {
                const stationId = `${station.codigo}_${lineId}`;
                const stationName = station.nombre;
                const normalizedStationName = normalizeStationName(stationName);
                const extraData = stationsDataLookup[normalizedStationName];

                const accessibility = Object.entries(accessibilityCache)
                    .filter(([id, item]) => item.estacion === station.codigo)
                    .map(([id, item]) => ({ id, ...item }));

                const aliases = [];
                if(extraData){
                    aliases.push(stationName.toLowerCase())
                }

                unifiedStations[stationId] = {
                    id: stationId,
                    name: stationName,
                    displayName: stationName,
                    line: lineId,
                    code: station.codigo,
                    status: station.estado === '1' ? 'operational' : 'closed',
                    combination: station.combinacion,
                    aliases: aliases,
                    transports: extraData ? extraData[0] : 'None',
                    services: extraData ? extraData[1] : 'None',
                    commerce: extraData ? extraData[3] : 'None',
                    amenities: extraData ? extraData[4] : 'None',
                    imageUrl: extraData ? extraData[5] : null,
                    commune: extraData ? extraData[6] : null,
                    accessibility: {
                        status: accessibility.length > 0 ? 'available' : 'unavailable',
                        details: accessibility,
                    },
                    _raw: { ...station, ...extraData },
                };
                unifiedLines[lineId].stations.push(stationId);
            }
        }

        return { stations: unifiedStations, lines: unifiedLines, ...apiData };

    } catch (error) {
        console.error('Error translating API data:', error);
        throw error;
    }
}

module.exports = { translateApiData };
