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
                    ost.status_description
                FROM
                    metro_stations ms
                LEFT JOIN
                    station_status ss ON ms.station_id = ss.station_id
                LEFT JOIN
                    operational_status_types ost ON ss.status_type_id = ost.status_type_id
            `;

            const stations = await dbManager.query(query);

            const stationData = {};
            for (const station of stations) {
                const stationId = station.station_code.toUpperCase();
                stationData[stationId] = {
                    id: stationId,
                    name: station.station_name,
                    linea: station.line_id.toLowerCase(),
                    status: station.status_description || '',
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
