// metroLoader.js
const DatabaseManager = require('../../../database/DatabaseManager');

module.exports = {
  source: 'MetroDB/system_info',
  async load(dbManager) {
    try {
        if (!dbManager) throw new Error('DatabaseManager is not provided to metroLoader');
        const rows = await dbManager.query("SELECT * FROM system_info LIMIT 1");
        return this._transform(rows[0]);
    } catch (err) {
        // Rethrow the error to be handled by the caller
        throw err;
    }
  },

  _transform(data){
    if (!data) return {};
    return {
        name: data.name,
        system: data.system,
        inauguration: data.inauguration,
        technicalCharacteristics: {
            length: data.length,
            stations: data.stations,
            trackGauge: data.track_gauge,
            electrification: data.electrification,
            maxSpeed: data.max_speed
        },
        operation: {
            status: data.status,
            lines: data.lines,
            cars: data.cars,
            passengers: data.passengers,
            fleet: data.fleet,
            averageSpeed: data.average_speed,
            operator: data.operator
        },
        mapUrl: data.map_url
    };
  }
};