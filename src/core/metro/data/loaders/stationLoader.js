// stationLoader.js
const path = require('path');
const fs = require('fs').promises;
const loadJsonFile = require('../../../../utils/jsonLoader.js');
const config = require('../../../../config/metro/metroConfig');
const styles = require('../../../../config/styles.json');
const estadoRedTemplate = {};

const DatabaseService = require('../../../database/DatabaseService');

module.exports = {
  source: 'MetroDB/metro_stations',
  async load() {
    try {
        const dbService = await DatabaseService.getInstance();
        const rows = await dbService.getAllStations();
        return this._transform(rows);
    } catch (err) {
        throw err;
    }
  },

  _transform(rows) {
    return rows.reduce((acc, row) => {
      const id = row.station_code.toUpperCase();
      acc[id] = {
        id: id,
        line: row.line_id,
        name: row.station_name,
        displayName: row.station_name,
        status: {code: '1', message:'operational'},
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
