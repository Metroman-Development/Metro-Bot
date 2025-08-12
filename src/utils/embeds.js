const { EmbedBuilder } = require('discord.js');
const styles = require('../config/metro/styles.json');

function createEmbed(description, type = 'primary', title = null) {
    const colorMap = {
        primary: styles.defaultTheme.primaryColor,
        success: styles.defaultTheme.successColor,
        error: styles.defaultTheme.errorColor,
        warning: styles.defaultTheme.warningColor,
        info: styles.defaultTheme.infoColor,
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
