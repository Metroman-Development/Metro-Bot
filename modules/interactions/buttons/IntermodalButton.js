// modules/interactions/buttons/IntermodalButton.js
const { EmbedBuilder, ActionRowBuilder, ButtonStyle, ButtonBuilder } = require('discord.js');
const BaseButton = require('./templates/baseButton');
const interactionStore = require('../utils/interactionStore');
const styles = require('../../../config/metro/styles.json');
const metroConfig = require('../../../config/metro/metroConfig');

class IntermodalButton extends BaseButton {
    constructor() {
        super({
            customIdPrefix: 'intermodal',
            style: ButtonStyle.Secondary
        });
        this.cacheDuration = 60 * 60 * 1000; // 1 hour cache
    }

    async buildInitialView(stationInfo, stationName) {
        const cacheKey = `intermodal_${stationName.toLowerCase().replace(/\s+/g, '_')}`;
        const cacheData = {
            type: 'intermodal',
            stationInfo,
            stationName,
            currentView: 'summary',
            timestamp: Date.now()
        };

        interactionStore.set(cacheKey, cacheData, this.cacheDuration);
        return this._createMessage(cacheData);
    }

    _createMessage(data) {
        const embed = new EmbedBuilder()
            .setTitle(`${metroConfig.logoMetroEmoji} ${data.stationName}`)
            .setColor(styles.defaultTheme.primaryColor);

        if (data.currentView === 'summary') {
            this._buildSummaryView(embed, data.stationInfo, data.stationName);
        } else {
            this._buildFullView(embed, data.stationInfo, data.stationName);
        }

        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`intermodal:view:summary:${data.stationName}`)
                .setLabel('Resumen')
                .setStyle(data.currentView === 'summary' ? ButtonStyle.Primary : ButtonStyle.Secondary)
                .setDisabled(data.currentView === 'summary'),
            new ButtonBuilder()
                .setCustomId(`intermodal:view:full:${data.stationName}`)
                .setLabel('Detalles')
                .setStyle(data.currentView === 'full' ? ButtonStyle.Primary : ButtonStyle.Secondary)
                .setDisabled(data.currentView === 'full')
        );

        return { embeds: [embed], components: [buttons] };
    }

    _buildSummaryView(embed, stationInfo, stationName) {
        embed.setDescription(`**Información esencial de ${stationName}**`)
            .addFields(
                { name: '🗺️ Sector', value: `${stationInfo.comuna}\n${stationInfo.location}`, inline: false },
                { name: '📅 Inauguración', value: stationInfo.inauguration, inline: true },
                { name: '👷 Operador', value: stationInfo.operator, inline: true },
                { name: '🚍 Conexiones principales', value: this._formatTopBuses(stationInfo.buses, 3), inline: false }
            );
    }

    _buildFullView(embed, stationInfo, stationName) {
        embed.setDescription(`**Detalles técnicos de ${stationName}**`)
            .addFields(
                { name: '🏗️ Infraestructura', value: `• Andenes: ${stationInfo.platforms}\n• Operador: ${stationInfo.operator}`, inline: false },
                { name: '📅 Historia', value: `Inaugurada: ${stationInfo.inauguration}\nComuna: ${stationInfo.comuna}`, inline: false },
                { name: '📍 Ubicación exacta', value: stationInfo.location, inline: false },
                { name: '🛠️ Servicios completos', value: stationInfo.services.map(s => `• ${s}`).join('\n'), inline: false },
                { name: '🚌 Todas las conexiones', value: this._formatAllBuses(stationInfo.buses), inline: false }
            );
    }

    _formatTopBuses(buses, limit) {
        return buses.slice(0, limit)
            .map(bus => typeof bus === 'object' 
                ? `• ${bus['Recorrido/Operador']} → ${bus.Destino} (${bus['Tipo Servicio']})` 
                : `• ${bus}`)
            .join('\n') || 'No hay información';
    }

    _formatAllBuses(buses) {
        return buses.map(bus => typeof bus === 'object'
            ? `• **${bus['Recorrido/Operador']}** (${bus['Tipo Servicio']}):\n  → ${bus.Destino}`
            : `• ${bus}`)
        .join('\n') || 'No hay información';
    }

    async handleInteraction(interaction) {
        const [_, action, viewType, stationName] = interaction.customId.split(':');
        
        try {
            const cacheKey = `intermodal_${stationName.toLowerCase().replace(/\s+/g, '_')}`;
            let cacheData = interactionStore.get(cacheKey);

            if (!cacheData) {
                return this._sendError(interaction, 'La sesión expiró. Ejecuta el comando nuevamente.');
            }

            cacheData.currentView = viewType;
            cacheData.timestamp = Date.now();

            interactionStore.set(cacheKey, cacheData, this.cacheDuration);
            await interaction.editReply(this._createMessage(cacheData));
        } catch (error) {
            console.error('Error en IntermodalButton:', error);
            this._sendError(interaction, 'Error al cambiar la vista');
        }
    }

    async _sendError(interaction, message) {
        const embed = new EmbedBuilder()
            .setTitle('⚠️ Error')
            .setDescription(message)
            .setColor(styles.defaultTheme.errorColor);

        if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ embeds: [embed], ephemeral: true });
        } else {
            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }
}

module.exports = IntermodalButton;
