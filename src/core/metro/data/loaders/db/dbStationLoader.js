// src/core/metro/data/loaders/db/dbStationLoader.js
const DatabaseManager = require('../../../../database/DatabaseManager');

class DbStationLoader {
    constructor() {
        this.source = 'database';
    }

    async load(dbManager) {
        try {
            if (!dbManager) throw new Error('DatabaseManager is not provided to dbStationLoader');

            const query = `
                SELECT
                    ms.station_code,
                    ms.station_name,
                    ms.line_id,
                    ms.commune,
                    ms.transports,
                    ms.services,
                    ms.commerce,
                    ms.amenities,
                    ms.image_url
                FROM
                    metro_stations ms
            `;

            const stations = await dbManager.query(query);

            const stationData = {};
            for (const station of stations) {
                const stationId = station.station_code.toUpperCase();
                stationData[stationId] = {
                    id: stationId,
                    name: station.station_name,
                    displayName: station.station_name,
                    line: station.line_id.toLowerCase(),
                    commune: station.commune,
                    transports: station.transports,
                    services: station.services,
                    commerce: station.commerce,
                    amenities: station.amenities,
                    image: station.image_url,
                };
            }

            return stationData;
        } catch (error) {
            console.error('Error loading station data from database:', error);
            throw error;
        }
    }
}

module.exports = new DbStationLoader();
