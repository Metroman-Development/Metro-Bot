const { EmbedBuilder } = require('discord.js');
const TabsTemplate = require('../templates/tabs');
const metroConfig = require('../../../config/metro/metroConfig');
const styles = require('../../../config/metro/styles.json');

// --- Helper functions to build embed content ---

function _formatTopBuses(buses, limit) {
    if (!buses) return 'No hay información';
    return buses.slice(0, limit)
        .map(bus => typeof bus === 'object'
            ? `• ${bus['Recorrido/Operador']} → ${bus.Destino} (${bus['Tipo Servicio']})`
            : `• ${bus}`)
        .join('\n') || 'No hay información';
}

function _formatAllBuses(buses) {
    if (!buses) return 'No hay información';
    return buses.map(bus => typeof bus === 'object'
        ? `• **${bus['Recorrido/Operador']}** (${bus['Tipo Servicio']}):\n  → ${bus.Destino}`
        : `• ${bus}`)
    .join('\n') || 'No hay información';
}

function buildSummaryView(embed, stationInfo) {
    embed.setDescription(`**Información esencial de ${stationInfo.name}**`)
        .addFields(
            { name: '🗺️ Sector', value: `${stationInfo.comuna}\n${stationInfo.location}`, inline: false },
            { name: '📅 Inauguración', value: stationInfo.inauguration, inline: true },
            { name: '👷 Operador', value: stationInfo.operator, inline: true },
            { name: '🚍 Conexiones principales', value: _formatTopBuses(stationInfo.buses, 3), inline: false }
        );
}

function buildFullView(embed, stationInfo) {
    embed.setDescription(`**Detalles técnicos de ${stationInfo.name}**`)
        .addFields(
            { name: '🏗️ Infraestructura', value: `• Andenes: ${stationInfo.platforms}\n• Operador: ${stationInfo.operator}`, inline: false },
            { name: '📅 Historia', value: `Inaugurada: ${stationInfo.inauguration}\nComuna: ${stationInfo.comuna}`, inline: false },
            { name: '📍 Ubicación exacta', value: stationInfo.location, inline: false },
            { name: '🛠️ Servicios completos', value: stationInfo.services.map(s => `• ${s}`).join('\n'), inline: false },
            { name: '🚌 Todas las conexiones', value: _formatAllBuses(stationInfo.buses), inline: false }
        );
}

// --- Tabs Template Implementation ---

module.exports = TabsTemplate.create({
    idPrefix: 'intermodal',

    tabs: [
        { id: 'info', label: 'Resumen', emoji: 'ℹ️' },
        { id: 'details', label: 'Detalles', emoji: '📋' }
    ],

    async fetchTabData(tabId, interaction, context) {
        // The context passed from the template's execute function contains the station info
        return context;
    },

    buildEmbed: (stationInfo, tabId) => {
        if (!stationInfo) {
            return new EmbedBuilder()
                .setTitle('⚠️ Error')
                .setDescription('La información de esta estación ha expirado.')
                .setColor(styles.defaultTheme.errorColor);
        }

        const embed = new EmbedBuilder()
            .setTitle(`${metroConfig.logoMetroEmoji} ${stationInfo.name}`)
            .setColor(styles.defaultTheme.primaryColor);

        if (tabId === 'info') {
            buildSummaryView(embed, stationInfo);
        } else { // details
            buildFullView(embed, stationInfo);
        }

        return embed;
    }
});
