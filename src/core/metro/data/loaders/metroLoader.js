// metroLoader.js
const mariadb = require('mariadb');
require('dotenv').config();
const pool = mariadb.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.METRODB_NAME,
    connectionLimit: 5
});

module.exports = {
  source: 'MetroDB/system_info',
  async load() {
    let conn;
    try {
        conn = await pool.getConnection();
        const rows = await conn.query("SELECT * FROM system_info LIMIT 1");
        return this._transform(rows[0]);
    } catch (err) {
        throw err;
    } finally {
        if (conn) conn.release();
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