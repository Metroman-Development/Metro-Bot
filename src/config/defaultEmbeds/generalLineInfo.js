const { EmbedBuilder } = require('discord.js');

function generalLineInfo(lineData, userId, interactionId) {
  const embed = new EmbedBuilder().setTitle(lineData.displayName);
  const buttons = [];
  return { embed, buttons };
}

module.exports = generalLineInfo;
