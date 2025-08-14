/**
 * @file lineaInfoEmbed.js
 * @description Creates the embed for the linea info command.
 */

const { EmbedBuilder } = require('discord.js');
const metroConfig = require('../config/metro/metroConfig');

function getStatusEmoji(statusCode) {
    const statusMap = metroConfig.statusMapping;
    return statusMap[statusCode]?.emoji || '⚪';
}

function create({ lineInfo, lineKey }) {
    const lineEmoji = metroConfig.linesEmojis[lineKey] || '🚇';

    const embed = new EmbedBuilder()
        .setTitle(`${lineEmoji} ${lineInfo.displayName}`)
        .setColor(lineInfo.color || '#0099FF')
        .setImage(`attachment://${lineKey}_map.png`)
        .addFields(
            {
                name: `${metroConfig.stationIcons[lineInfo.status.code]?.emoji || '📊'} Estado`,
                value: `${getStatusEmoji(lineInfo.status.code)} ${metroConfig.statusMapping[lineInfo.status.code]?.message || lineInfo.status.appMessage || 'Estado desconocido'}`,
                inline: true
            },
            {
                name: '🎨 Color',
                value: `\`${lineInfo.color}\``,
                inline: true
            },
            {
                name: '📏 Longitud',
                value: lineInfo.details.length || 'N/A',
                inline: true
            },
            {
                name: '🚉 Estaciones',
                value: lineInfo.details.stations || 'N/A',
                inline: true
            },
            {
                name: '📅 Inauguración',
                value: lineInfo.details.inauguration || 'N/A',
                inline: true
            }
        );

    if (lineInfo.details.communes?.length > 0) {
        embed.addFields({
            name: '🏙️ Comunas',
            value: lineInfo.details.communes.join(', '),
            inline: false
        });
    }

    embed.setFooter({
        text: 'Metro de Santiago • Última actualización',
        iconURL: metroConfig.metroLogo.principal
    }).setTimestamp();

    return embed;
}

module.exports = {
    create,
};
