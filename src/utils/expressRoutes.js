const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const metroConfig = require('../config/metroConfig');
const styles = require('../config/styles.json');
const { decorateStation, normalize } = require('./stringUtils');
const expressRoutePaginator = require('../events/interactions/buttons/expressRoutePaginator');

// Utility functions
function normalizeRoute(route) {
    return route?.normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/ruta /g, '') || '';
}

function resolveRouteCombination(selectedRoute, currentRoute) {
    const normalizedCurrent = normalizeRoute(currentRoute);
    const isComun = normalizedCurrent.includes('comun');
    const isVerde = normalizedCurrent.includes('verde');
    const isRoja = normalizedCurrent.includes('roja');

    switch(selectedRoute) {
        case 'todas': return 'todas';
        case 'comun':
            if (isVerde) return 'comun+verde';
            if (isRoja) return 'comun+roja';
            return isComun ? 'todas' : 'comun';
        case 'verde':
            if (isRoja) return 'todas';
            return isComun ? 'comun+verde' : 'verde';
        case 'roja':
            if (isVerde) return 'todas';
            return isComun ? 'comun+roja' : 'roja';
        default: return selectedRoute;
    }
}

function getStationsByRoute(lineKey, route) {
    const lineStations = require('../data/stations.json')[lineKey] || {};

    if (route === 'todas') return Object.keys(lineStations);

    if (route.includes('+')) {
        const routes = route.split('+');
        return Object.entries(lineStations)
            .filter(([_, data]) =>
                routes.some(r => normalizeRoute(data.ruta) === normalizeRoute(r)))
            .map(([name]) => name);
    }

    const normalizedRoute = normalizeRoute(route);
    return Object.entries(lineStations)
        .filter(([_, data]) => data.ruta && normalizeRoute(data.ruta) === normalizedRoute)
        .map(([name]) => name);
}

function getExpressRoutePage(lineKey, route, page = 0, userId) {
    const stationsList = getStationsByRoute(lineKey, route);
    const totalPages = Math.ceil(stationsList.length / 10);
    const pageStations = stationsList.slice(page * 10, (page + 1) * 10);

    const embed = new EmbedBuilder()
        .setColor(metroConfig.lineColors[lineKey] || '#5865F2')
        .setTitle(`Línea ${lineKey.toUpperCase()} - Ruta ${route.toUpperCase()}`)
        .setDescription(`**Estaciones activas (${stationsList.length}):**\n${pageStations.join(', ')}`)
        .setFooter({ text: `Página ${page + 1} de ${totalPages}` });

    const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`${expressRoutePaginator.customIdPrefix}:${JSON.stringify({ action: 'prev', line: lineKey, route, page, userId })}`)
            .setLabel('Anterior')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(page === 0),
        new ButtonBuilder()
            .setCustomId(`${expressRoutePaginator.customIdPrefix}:${JSON.stringify({ action: 'next', line: lineKey, route, page, userId })}`)
            .setLabel('Siguiente')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(page >= totalPages - 1)
    );

    return { embed, components: [buttons] };
}

// Route handling function
async function handleExpressRoute(interaction, lineKey, route, userId) {
    try {
        const stationsList = getStationsByRoute(lineKey, route);

        if (!stationsList.length) {
            return interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor('#FF0000')
                        .setTitle('❌ Sin resultados')
                        .setDescription(`No hay estaciones con ${route} en Línea ${lineKey.toUpperCase()}`)
                ],
                ephemeral: true
            });
        }

        const { embed, components } = getExpressRoutePage(lineKey, route, 0, userId);

        await interaction.editReply({ embeds: [embed], components });

    } catch (error) {
        console.error('Error in handleExpressRoute:', error);
        await interaction[interaction.replied ? 'followUp' : 'reply']({
            content: '❌ Error al procesar el comando',
            ephemeral: true
        });
    }
}

// Combined exports
module.exports = {
    normalizeRoute,
    resolveRouteCombination,
    getStationsByRoute,
    handleExpressRoute,
    getExpressRoutePage,
};
