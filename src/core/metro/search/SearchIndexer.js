const Normalizer = require('../utils/stringHandlers/normalization');

class SearchIndexer {
  constructor(data) {
    this.data = data;
    this.index = {
      stations: {},
      lines: {},
    };
  }

  buildIndex() {
    this.index.stations = this._buildStationIndex(this.data.stations);
    this.index.lines = this._buildLineIndex(this.data.lines);
  }

  _buildStationIndex(stations) {
    if (Array.isArray(stations)) {
      return stations.reduce((acc, station) => {
        if (station && station.id) {
          acc[station.id] = this._processStation(station);
        }
        return acc;
      }, {});
    } else {
      return Object.entries(stations).reduce((acc, [id, station]) => {
        acc[id] = this._processStation(station);
        return acc;
      }, {});
    }
  }

  _buildLineIndex(lines) {
    return Object.entries(lines).reduce((acc, [id, line]) => {
      acc[id] = this._processLine(line);
      return acc;
    }, {});
  }

  _processStation(station) {
    return {
      ...station,
      normalizedName: Normalizer.normalize(station.name),
      normalizedCommune: Normalizer.normalize(station.commune),
    };
  }

  _processLine(line) {
    return {
      ...line,
      normalizedName: Normalizer.normalize(line.name),
    };
  }

  getIndex() {
    return this.index;
  }
}

module.exports = SearchIndexer;
