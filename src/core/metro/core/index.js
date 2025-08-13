const { loadStations } = require('../data/loaders/stationData');

const { loadLines } = require('../data/loaders/lineData');

const stringUtils = require('../modules/metro/utils/stringHandlers');

module.exports = async () => {

  const [stationsData, linesData] = await Promise.all([

    loadStations(),

    loadLines()

  ]);

  const cores = {

    stationsCore: require('./stationsCore')(stationsData.rawStations),

    linesCore: require('./linesCore')(linesData),

    stringUtils

  };

  return {

    stations: require('../modules/metro/queries/stations')(cores),

    lines: require('../modules/metro/queries/lines')(cores),

    utils: cores.stringUtils

  };

}; 