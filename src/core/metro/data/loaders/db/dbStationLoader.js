// src/core/metro/data/loaders/db/dbStationLoader.js
const DatabaseManager = require('../../../../database/DatabaseManager');

class DbStationLoader {
    constructor() {
        this.source = 'database';
    }

    async load() {
        try {
            const db = await DatabaseManager.getInstance();
            const stations = await db.query('SELECT * FROM metro_stations');

            const stationData = {};
            for (const station of stations) {
                stationData[station.station_code] = {
                    nombre: station.station_name,
                    linea: station.line_id,
                    // Add other properties as needed from the metro_stations table
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
