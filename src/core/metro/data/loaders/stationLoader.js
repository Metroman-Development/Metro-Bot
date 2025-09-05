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
        station_id: row.station_id,
        line: row.line_id,
        name: row.station_name,
        displayName: row.display_name || row.station_name,
        displayOrder: row.display_order,
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
        address: row.address,
        latitude: row.latitude,
        longitude: row.longitude,
        location: row.location,
        opened_date: row.opened_date,
        last_renovation_date: row.last_renovation_date,
        created_at: row.created_at,
        updated_at: row.updated_at,
        combinacion: row.combinacion,
      };
      return acc;
    }, {});
  }
};
