const { loadStations } = require('../utils/stationData.js');

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

    stations: require('../queries/stations.js')(cores),

    lines: require('../queries/lines.js')(cores),

    utils: cores.stringUtils

  };

}; 