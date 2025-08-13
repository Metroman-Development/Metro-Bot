// Factory function implementation
module.exports = function(core) {
  let currentData = null;

  return {
    get metroData() {
      return currentData || core.data;
    },

    set metroData(data) {
      currentData = data;
      core.update(data);
    },

    getCachedMetroData() {
      return this.metroData;
    },

    findStation(identifier) {
      return core.getStation(identifier);
    },

    // Additional legacy methods
    getStationStatus(stationId) {
      const station = core.getStation(stationId);
      return station?.status || 'unknown';
    },

    getLineStatus(lineId) {
      const line = core.getLine(lineId);
      return line?.status || 'unknown';
    }
  };
};