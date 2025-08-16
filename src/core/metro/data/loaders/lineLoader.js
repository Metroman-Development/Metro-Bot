const path = require('path');
const loadJsonFile = require('../../../../utils/jsonLoader');
const styles = require('../../../../config/styles.json');
const estadoRedTemplate = {};

const DatabaseManager = require('../../../database/DatabaseManager');

module.exports = {
  source: 'MetroDB/metro_lines',
  async load() {
    try {
        const dbManager = await DatabaseManager.getInstance();
        const rows = await dbManager.query("SELECT * FROM metro_lines");
        return this._transform(rows);
    } catch (err) {
        throw err;
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
