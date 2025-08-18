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
                    ms.display_name,
                    ms.line_id,
                    ms.commune,
                    ms.transports,
                    ms.services,
                    ms.commerce,
                    ms.amenities,
                    ms.image_url,
                    ss.status_description,
                    ss.status_message,
                    ss.is_planned,
                    ss.impact_level,
                    ost.status_name as status_code,
                    ost.is_operational
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
                    displayName: station.display_name || station.station_name,
                    line: station.line_id.toLowerCase(),
                    commune: station.commune,
                    transports: station.transports,
                    services: station.services,
                    commerce: station.commerce,
                    amenities: station.amenities,
                    image: station.image_url,
                    status: {
                        code: station.status_code || 'operational',
                        description: station.status_description,
                        message: station.status_message,
                        isPlanned: station.is_planned,
                        impactLevel: station.impact_level,
                        isOperational: station.is_operational !== 0,
                    }
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
