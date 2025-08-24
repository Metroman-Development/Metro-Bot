const fs = require('fs').promises;
const path = require('path');

class DataManager {
    constructor() {
        this.stations = null;
        this.lines = null;
    }

    async loadData() {
        try {
            const stationsDataPath = path.join(__dirname, '..', '..', '..', 'data', 'stationsData.json');
            const estadoRedPath = path.join(__dirname, '..', '..', '..', 'data', 'estadoRed.json');
            const accessibilityCachePath = path.join(__dirname, '..', '..', '..', 'data', 'accessibilityCache.json');

            const stationsDataFile = await fs.readFile(stationsDataPath, 'utf8');
            const estadoRedFile = await fs.readFile(estadoRedPath, 'utf8');
            const accessibilityCacheFile = await fs.readFile(accessibilityCachePath, 'utf8');

            const stationsData = JSON.parse(stationsDataFile).stationsData;
            const estadoRedData = JSON.parse(estadoRedFile);
            const accessibilityCache = JSON.parse(accessibilityCacheFile);

            const unifiedStations = {};
            const unifiedLines = {};

            const stationsDataLookup = {};
            for (const key in stationsData) {
                stationsDataLookup[normalizeStationName(key)] = stationsData[key];
            }

            for (const lineId in estadoRedData) {
                const line = estadoRedData[lineId];
                unifiedLines[lineId] = {
                    id: lineId,
                    name: `Línea ${lineId.toUpperCase()}`,
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

            this.stations = unifiedStations;
            this.lines = unifiedLines;

        } catch (error) {
            console.error('Error loading data in DataManager:', error);
            throw error;
        }
    }

    getStations() {
        return this.stations;
    }

    getLines() {
        return this.lines;
    }
}

module.exports = DataManager;
