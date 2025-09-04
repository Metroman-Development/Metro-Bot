const { MetroInfoProvider } = require('../../../utils/MetroInfoProvider');
const lineLoader = require('../data/loaders/lineLoader.js');
const stringUtils = require('../utils/stringHandlers');

module.exports = async () => {
  const [stationsData, linesData] = await Promise.all([
    MetroInfoProvider.getStations(),
    lineLoader.load()
  ]);

  const cores = {
    stationsCore: require('./stationsCore')(stationsData),
    linesCore: require('./linesCore')(linesData),
    stringUtils
  };

  return {
    stations: require('../queries/stations.js')(cores),
    lines: require('../queries/lines.js')(cores),
    utils: cores.stringUtils
  };
}; 