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

async function translateApiData(apiData, dbService) {
    try {
        const [stationsData, accessibilityCache] = await Promise.all([
            dbService.getAllStationsStatusAsRaw(),
            dbService.getAccessibilityStatus()
        ]);


        const unifiedStations = {};
        const unifiedLines = {};

        const stationsDataLookup = {};
        for (const station of stationsData) {
            stationsDataLookup[station.station_code.toUpperCase()] = station;
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
                const stationId = `${station.codigo}`;
                const stationName = station.nombre;
                const extraData = stationsDataLookup[station.codigo.toUpperCase()];

                const accessibility = accessibilityCache
                    .filter(item => item.station_code === station.codigo)
                    .map(item => ({ ...item }));

                const aliases = [];
                if(extraData){
                    aliases.push(stationName.toLowerCase())
                }

                const station_data = {
                    ...extraData,
                    ...station,
                    ...(extraData?.status_data || {}),
                    id: stationId,
                    name: stationName,
                    displayName: stationName,
                    line: lineId,
                    code: station.codigo,
                    status: { code: station.estado, message: station.descripcion, appMessage: station.descripcion_app },
                    combination: station.combinacion,
                    aliases: aliases,
                    accessibility: {
                        status: accessibility.length > 0 ? 'available' : 'unavailable',
                        details: accessibility,
                    },
                    _raw: { ...station, ...extraData },
                };

                unifiedStations[stationId] = station_data;
                unifiedLines[lineId].stations.push(stationId);
            }
        }

        return { stations: unifiedStations, lines: unifiedLines, ...apiData };

    } catch (error) {
        console.error('Error translating API data:', error);
        // Return a default structure in case of an error to avoid breaking the calling code.
        return { stations: {}, lines: {}, ...apiData };
    }
}

module.exports = { translateApiData };
