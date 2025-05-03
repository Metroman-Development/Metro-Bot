// modules/metro/utils/expressHandlers.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const metroConfig = require('../../../config/metroConfig');

module.exports = {
    createRouteEmbed: (lineId, route, stations) => {
        const embed = new EmbedBuilder()
            .setColor(metroConfig.lineColors[lineId] || '#5865F2')
            .setTitle(`Línea ${lineId.toUpperCase()} - Ruta ${route.toUpperCase()}`)
            .setDescription(`**Estaciones activas (${stations.length}):**\n${stations.join(', ')}`);

        return { embed };
    },

    createRouteButtons: (lineId, route, currentPage, totalPages, userId) => {
        return new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`prev_${lineId}_${route}_${userId}_${currentPage}`)
                .setLabel('Anterior')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(currentPage === 0),
            new ButtonBuilder()
                .setCustomId(`next_${lineId}_${route}_${userId}_${currentPage}`)
                .setLabel('Siguiente')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(currentPage >= totalPages - 1)
        );
    }
};