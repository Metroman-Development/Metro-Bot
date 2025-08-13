const { EmbedBuilder, ButtonStyle } = require('discord.js');
const TabsTemplate = require('../templates/tabs');
const metroConfig = require('../../../config/metro/metroConfig');
const styles = require('../../../../config/styles.json');

// --- Helper Functions (from the old RouteButton class) ---

function _getRouteColor(routeData) {
    if (routeData.options?.fastest?.segments?.length > 0) {
        const firstSegment = routeData.options.fastest.segments[0];
        const line = firstSegment.type === 'combinacion'
            ? firstSegment.transferLine
            : firstSegment.from.line;
        return styles.lineColors[line.toLowerCase()] || 0x000000;
    }
    return styles.defaultTheme.primaryColor;
}

function _createOverviewEmbed(routeData) {
    const origin = routeData.origin;
    const destination = routeData.destination;

    const embed = new EmbedBuilder()
        .setTitle(`${metroConfig.logoMetroEmoji} Ruta: ${metroConfig.linesEmojis[origin.line.toLowerCase()]} ${origin.name} → ${metroConfig.linesEmojis[destination.line.toLowerCase()]} ${destination.name}`)
        .setColor(_getRouteColor(routeData))
        .setDescription(`**⌚ Período Tarifario:** ${routeData.farePeriod}\n🚶 Selecciona un tipo de ruta abajo:`);

    if (routeData.options) {
        const optionsText = [];
        if (routeData.options.fastest) {
            optionsText.push(`🚄 **Más rápido:** ${routeData.options.fastest.totalTime} min (${routeData.options.fastest.transferCount} trasbordos)`);
        }
        if (routeData.options.balanced) {
            optionsText.push(`⚖️ **Equilibrado:** ${routeData.options.balanced.totalTime} min (${routeData.options.balanced.transferCount} trasbordos)`);
        }
        if (routeData.options.slowest) {
            optionsText.push(`🐢 **Más lento:** ${routeData.options.slowest.totalTime} min (${routeData.options.slowest.transferCount} trasbordos)`);
        }

        embed.addFields({
            name: '🚇 Opciones Disponibles',
            value: optionsText.join('\n') || 'No hay opciones disponibles',
            inline: false
        });
    }
    return embed;
}

function _createSegmentDescription(segment, staticData, allData) {
    if (segment.type === 'combinacion' || segment.type === 'cambio') {
        return `🚶‍♂️ **Trasbordo** en *${segment.transferStation.name}*`;
    }
    return `🚇 **Viaje** Línea ${metroConfig.linesEmojis[segment.from?.line.toLowerCase()] ?? ""} Dirección \`${segment.direction}\`\n` +
           `**${segment.from.name}** ⏩ **${segment.to.name}**`;
}

function _createRouteDetailEmbed(routeOption, title, color, staticData, metroData) {
    if (!routeOption) {
        return new EmbedBuilder().setTitle('Opción no disponible').setColor('#95a5a6');
    }
    const embed = new EmbedBuilder()
        .setTitle(`${metroConfig.logoMetroEmoji} ${title}`)
        .setColor(color)
        .addFields(
            { name: '⏱️ Tiempo Total', value: `${routeOption.totalTime} minutos`, inline: true },
            { name: '🔄 Trasbordos', value: `${routeOption.transferCount}`, inline: true },
            { name: '🚇 Estaciones', value: `${routeOption.stationCount}`, inline: true }
        );
    const segmentsText = routeOption.segments.map((segment) => _createSegmentDescription(segment, staticData, metroData)).join('\n\n');
    embed.addFields({ name: '📝 Itinerario', value: segmentsText, inline: false });
    return embed;
}


// --- Tabs Template Implementation ---

module.exports = TabsTemplate.create({
    idPrefix: 'routeInfo',

    tabs: [
        { id: 'overview', label: '👀 Resumen', style: ButtonStyle.Primary },
        { id: 'fastest', label: '🚅 Más Rápido', style: ButtonStyle.Success },
        { id: 'balanced', label: '⚖️ Equilibrado', style: ButtonStyle.Secondary },
        { id: 'slowest', label: '🐢 Más Lento', style: ButtonStyle.Danger }
    ],

    async fetchTabData(tabId, interaction, context) {
        return context; // The route data is passed as context
    },

    buildEmbed: (routeData, tabId) => {
        const { route, staticData, metroData } = routeData;
        switch (tabId) {
            case 'fastest':
                return _createRouteDetailEmbed(route.options.fastest, 'Ruta Más Rápida', '#2ecc71', staticData, metroData);
            case 'balanced':
                return _createRouteDetailEmbed(route.options.balanced, 'Ruta Equilibrada', '#3498db', staticData, metroData);
            case 'slowest':
                return _createRouteDetailEmbed(route.options.slowest, 'Ruta Más Lenta', '#e74c3c', staticData, metroData);
            default:
                return _createOverviewEmbed(route);
        }
    }
});
