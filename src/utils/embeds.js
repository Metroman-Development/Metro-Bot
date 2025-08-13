const { EmbedBuilder } = require('discord.js');
// const styles = require('../config/metro/styles.json');

function createEmbed(description, type = 'primary', title = null) {
    const colorMap = {
        primary: '#0099ff',
        success: '#00ff00',
        error: '#ff0000',
        warning: '#ffcc00',
        info: '#00ffff',
    };

    const embed = new EmbedBuilder()
        .setDescription(description)
        .setColor(colorMap[type] || colorMap.primary);

    if (title) {
        embed.setTitle(title);
    }

    return embed;
}

module.exports = { createEmbed };