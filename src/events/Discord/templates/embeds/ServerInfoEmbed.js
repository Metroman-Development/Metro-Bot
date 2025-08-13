const { EmbedBuilder } = require('discord.js');

class ServerInfoEmbed {
  createChannelsEmbed(data) {
    return new EmbedBuilder().setTitle('Channels');
  }

  createRolesEmbed(data) {
    return new EmbedBuilder().setTitle('Roles');
  }

  createEmojisEmbed(data) {
    return new EmbedBuilder().setTitle('Emojis');
  }

  createFeaturesEmbed(data) {
    return new EmbedBuilder().setTitle('Features');
  }

  createMainEmbed(data) {
    return new EmbedBuilder().setTitle('Main');
  }
}

module.exports = ServerInfoEmbed;
