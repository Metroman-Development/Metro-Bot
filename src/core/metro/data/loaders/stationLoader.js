// stationLoader.js
const path = require('path');
const fs = require('fs').promises;
const loadJsonFile = require('../../../../utils/jsonLoader.js');
const config = require('../../../../config/metro/metroConfig');
const styles = require('../../../../config/styles.json');
const estadoRedTemplate = {};

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
  source: 'MetroDB/metro_stations',
  async load() {
    let conn;
    try {
        conn = await pool.getConnection();
        const rows = await conn.query("SELECT * FROM metro_stations");
        return this._transform(rows);
    } catch (err) {
        throw err;
    } finally {
        if (conn) conn.release();
    }
  },

  _transform(rows) {
    return rows.reduce((acc, row) => {
      const id = row.station_code.toUpperCase();
      acc[id] = {
        id: id,
        line: row.line_id,
        displayName: row.station_name,
        status: {message:'operational'},
        color: styles.lineColors[row.line_id] || config.defaultLineColor,
        connections: { transports: [], bikes: [] },
        transports: row.transports,
        services: row.services,
        accessibility: row.accessibility,
        accessDetails: typeof row.access_details === 'string' ? JSON.parse(row.access_details) : row.access_details,
        commerce: row.commerce,
        amenities: row.amenities,
        image: row.image_url,
        commune: row.commune,
      };
      return acc;
    }, {});
  }
};
