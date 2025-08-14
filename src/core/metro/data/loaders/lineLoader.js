const path = require('path');
const loadJsonFile = require('../../../../utils/jsonLoader');
const styles = require('../../../../config/styles.json');
const estadoRedTemplate = {};

const mariadb = require('mariadb');
const pool = mariadb.createPool({
    host: '127.0.0.1',
    user: 'metroapi',
    password: 'Metro256',
    database: 'MetroDB',
    connectionLimit: 5
});

module.exports = {
  source: 'MetroDB/metro_lines',
  async load() {
    let conn;
    try {
        conn = await pool.getConnection();
        const rows = await conn.query("SELECT * FROM metro_lines");
        return this._transform(rows);
    } catch (err) {
        throw err;
    } finally {
        if (conn) conn.release();
    }
  },

  _transform(rows) {
    return rows.reduce((acc, row) => {
      const id = row.line_id.toLowerCase();
      acc[id] = {
        id,
        displayName: row.line_name,
        color: styles.lineColors[id] || '#CCCCCC',
        status: {
          code: "1",
          message: "",
          appMessage: row.line_description
        },
        fleet: [],
        details: {
          length: row.total_length_km,
          stations: row.total_stations,
          inauguration: row.opening_date,
          communes: []
        },
        infrastructure: {
          operationalStatus: "operational",
          lastUpdated: new Date(),
          stationCodes: []
        }
      };
      return acc;
    }, {});
  }
};
