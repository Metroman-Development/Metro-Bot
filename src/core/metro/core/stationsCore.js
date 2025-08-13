const { normalize } = require('../../modules/metro/utils/stringHandlers/normalization');

module.exports = (stationsData) => {
  const indexes = {
    stations: stationsData.reduce((acc, station) => ({ 
      ...acc, 
      [station.code]: station 
    }), {})
  };

  const getStation = (identifier) => 
    indexes.stations[identifier] || null;

  return {
    indexes,
    getStation,
    normalizeStationName: (name) => normalize(name)
  };
};