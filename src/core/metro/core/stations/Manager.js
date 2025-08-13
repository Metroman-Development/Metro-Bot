const StationFilters = require('./Filters');
const StationConnections = require('./Connections');
const { normalize } = require('../../utils/stringHandlers/normalization.js');

module.exports = class StationManager {
  constructor(stationsData) {
    this._data = stationsData.map(s => ({
      ...s,
      normalized: normalize(s.name) // Pre-normalize for search
    }));
    this.filters = new StationFilters();
    this.connections = new StationConnections();
  }

  get(id) {
    return this._data.find(s => s.id === id);
  }

  search(query, options = {}) {
    const normalizedQuery = normalize(query);
    const { maxResults = 5, lineFilter = null } = options;

    // Combined search logic
    const results = this._data.filter(station => {
      const matchesQuery = station.normalized.includes(normalizedQuery);
      const matchesLine = lineFilter ? station.line === lineFilter : true;
      return matchesQuery && matchesLine;
    });

    return results.slice(0, maxResults);
  }

  getConnections(id) {
    return this.connections.getForStation(id);
  }
};