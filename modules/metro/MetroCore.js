/*// modules/metro/MetroCore.js
// core/MetroCore.js

const StationsCore = require('./tentacles/stationsCore');

const LinesCore = require('./tentacles/linesCore');

const ConnectionsCore = require('./tentacles/connectionsCore');

const stringUtils = require('../modules/metro/utils/stringHandlers');

class MetroCore {

  constructor() {

    // Existing properties

    this.data = null;

    this.cache = {

      data: null,

      lastUpdated: null,

      isUpdating: false

    };

    

    // New modular cores (tentacles)

    this._tentacles = {

      stations: null,

      lines: null,

      connections: null,

      utils: stringUtils

    };

  }

  async initialize() {

    // Existing initialization logic...

    const rawData = await this._loadData();

    // Initialize tentacles

    this._tentacles.stations = new StationsCore(rawData.stations);

    this._tentacles.lines = new LinesCore(rawData.lines);

    this._tentacles.connections = new ConnectionsCore(rawData.connections);

    // Build indexes

    this._buildIndexes();

  }

  // ======================

  // PUBLIC ACCESS TO TENTACLES

  // ======================

  get stations() {

    return {

      get: (id) => this._tentacles.stations.get(id),

      search: (filters) => this._tentacles.stations.search(filters),

      connections: (id) => this._tentacles.connections.getForStation(id)

    };

  }

  get lines() {

    return {

      get: (id) => this._tentacles.lines.get(id),

      status: (id) => this._tentacles.lines.getStatus(id),

      stations: (id) => this._tentacles.stations.getByLine(id)

    };

  }

  get utils() {

    return this._tentacles.utils;

  }

  // ======================

  // MAINTAINED LEGACY METHODS

  // ======================

  getStation(identifier) {

    // Legacy support

    return this._tentacles.stations.get(identifier);

  }

  getLine(lineId) {

    // Legacy support

    return this._tentacles.lines.get(lineId);

  }

}

module.exports = MetroCore;*/