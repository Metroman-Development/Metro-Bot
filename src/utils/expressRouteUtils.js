const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const metroConfig = require('../config/metro/metroConfig.js');
const styles = require('../config/styles.json');
const { decorateStation, normalize } = require('./stringUtils');

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
    const lineStations = {};

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

// Route handling function
async function handleExpressRoute(interaction, lineKey, route, userId, embedId) {
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

        const { createRouteEmbed, createRouteButtons } = require('./expressRouteInfo');
        const { embed } = createRouteEmbed(lineKey, route, stationsList);
        const buttons = createRouteButtons(lineKey, route, 0, Math.ceil(stationsList.length / 10), userId, embedId);

        await interaction.editReply({ embeds: [embed], components: buttons });

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
    handleExpressRoute
};
