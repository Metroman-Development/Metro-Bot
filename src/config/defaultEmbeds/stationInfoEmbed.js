const { EmbedBuilder } = require('discord.js');

function createGeneralStationInfo(stationData) {
  return new EmbedBuilder().setTitle(stationData.name);
}

function createStationSurroundings(stationData) {
  return new EmbedBuilder().setTitle(`Surroundings of ${stationData.name}`);
}

module.exports = {
  createGeneralStationInfo,
  createStationSurroundings,
};
