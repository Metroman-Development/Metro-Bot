const { ButtonStyle, ActionRowBuilder, ButtonBuilder, EmbedBuilder, StringSelectMenuBuilder } = require('discord.js');
const cacheManager = require('../utils/cacheManager');
const metroConfig = require('../config/metro/metroConfig');
const { createErrorEmbed, createEmbed } = require('../utils/embedFactory');
const { getLineColor, getLineImage } = require('../utils/metroUtils');

const CUSTOM_ID_PREFIX = 'stationInfo';
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

const tabs = {
    main: {
        label: 'ℹ️ Información',
        style: ButtonStyle.Primary,
        emoji: 'ℹ️'
    },
    surroundings: {
        label: '🗺️ Alrededores',
        style: ButtonStyle.Secondary,
        emoji: '🗺️'
    },
    transfers: {
        label: '🔄 Combinaciones',
        style: ButtonStyle.Success,
        emoji: '🔄'
    },
    accessibility: {
        label: '♿ Accesibilidad',
        style: ButtonStyle.Secondary,
        emoji: '♿',
        isToggle: true
    },
    // Accessibility sub-tabs
    acc_summary: {
        label: '📋 Resumen',
        style: ButtonStyle.Secondary,
        emoji: '📋',
        parent: 'accessibility'
    },
    acc_elevators: {
        label: '🛗 Ascensores',
        style: ButtonStyle.Secondary,
        emoji: '🛗',
        parent: 'accessibility'
    },
    acc_escalators: {
        label: '🪜 Escaleras',
        style: ButtonStyle.Secondary,
        emoji: '🪜',
        parent: 'accessibility'
    },
    acc_accesses: {
        label: '🚪 Accesos',
        style: ButtonStyle.Secondary,
        emoji: '🚪',
        parent: 'accessibility'
    }
};


class DiscordMessageFormatter {
    _getCacheKey(stationId, userId) {
        return `${CUSTOM_ID_PREFIX}:${userId}:${stationId}`;
    }

    async _createErrorMessage(message) {
        const errorEmbed = await createErrorEmbed(message);
        return {
            embeds: [errorEmbed],
            components: [],
            ephemeral: true
        };
    }

    _enrichStationData(station) {
        let transferLines = [];
        let connections = station.connections;
        if (typeof connections === 'string') {
            try {
                connections = JSON.parse(connections);
            } catch (e) {
                connections = null;
            }
        }

        if (Array.isArray(connections)) {
            transferLines.push(...connections);
        }

        if (station.transfer) {
            transferLines.push(station.transfer);
        }

        const uniqueTransferLines = [...new Set(transferLines)];

        return {
            ...station,
            id: station.id,
            displayName: station.displayName || 'Unknown Station',
            line: station.line || 'L0',
            transferLines: uniqueTransferLines,
            color: station.color || getLineColor(station.line),
            image: station.image || getLineImage(station.line)
        };
    }

    _findTransferStation(currentStation, line, metroData) {
        if (!line || !currentStation?.displayName) return null;

        const baseName = currentStation.displayName.replace(/\s(L\d+[a-z]?)$/i, '').trim();
        const transferDisplayName = `${baseName} ${line.toUpperCase()}`;

        return Object.values(metroData.stations || {})
            .find(s => s?.displayName === transferDisplayName);
    }

    _getTransferStationId(currentStation, metroData) {
        if (!currentStation?.transferLines?.length) return null;
        const transferStation = this._findTransferStation(currentStation, currentStation.transferLines[0], metroData);
        return transferStation?.id;
    }

    _createActionRows(cacheData) {
        const { currentTab, station } = cacheData;
        const mainButtons = new ActionRowBuilder();
        const accessibilityButtons = new ActionRowBuilder();

        // Main tabs
        for (const [key, tabInfo] of Object.entries(tabs)) {
            if (!tabInfo.parent) {
                const button = new ButtonBuilder()
                    .setCustomId(`${CUSTOM_ID_PREFIX}:${station.id}:${key}`)
                    .setLabel(tabInfo.label)
                    .setStyle(key === currentTab ? ButtonStyle.Primary : ButtonStyle.Secondary)
                    .setDisabled(key === currentTab);
                mainButtons.addComponents(button);
            }
        }

        const components = [mainButtons];

        // Accessibility dropdown
        if (currentTab.startsWith('acc_')) {
            const accessibilityOptions = Object.entries(tabs)
                .filter(([_, tabInfo]) => tabInfo.parent === 'accessibility')
                .map(([key, tabInfo]) => ({
                    label: tabInfo.label,
                    value: `${CUSTOM_ID_PREFIX}:${station.id}:${key}`,
                    default: key === currentTab
                }));

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId(`${CUSTOM_ID_PREFIX}:${station.id}:accessibility_select`)
                .setPlaceholder('Selecciona un detalle de accesibilidad')
                .addOptions(accessibilityOptions);
            accessibilityButtons.addComponents(selectMenu);
            components.push(accessibilityButtons);
        }

        return components;
    }

    async _createStationMessage(cacheData, userId) {
        if (!cacheData?.station) {
            return this._createErrorMessage('Station data unavailable');
        }

        try {
            const embed = await this._createEmbedForTab(cacheData);
            const components = this._createActionRows(cacheData);

            return {
                embeds: [embed],
                components: components,
                fetchReply: true
            };
        } catch (error) {
            console.error('[stationInfoButton] Message creation failed:', error);
            return this._createErrorMessage('Error generating station info');
        }
    }

    async _createMainEmbed(station, metroData) {
        return createEmbed('stationMain', { station, metroData });
    }

    async _createSurroundingsEmbed(station) {
        const embed = new EmbedBuilder()
            .setTitle(`🗺️ Alrededores de ${station.name}`)
            .setColor(station.color)
            .setImage(station.image_url);

        // Add more details about surroundings if available
        return embed;
    }

    async _createAccessibilityEmbed(station, tab) {
        const embed = new EmbedBuilder()
            .setTitle(`♿ Accesibilidad en ${station.name}`)
            .setColor(station.color);

        const operational = '✅ Operativo';
        const notOperational = '❌ No operativo';

        if (!station.accessibility || station.accessibility.length === 0) {
            embed.setDescription('No hay información de accesibilidad disponible para esta estación.');
            return embed;
        }

        const nonOperational = station.accessibility
            .filter(item => item.status !== 'ok')
            .map(item => item.type);

        let summary;
        if (nonOperational.length > 0) {
            summary = `❌ **Incidencias:** ${nonOperational.join(', ')}.`;
        } else {
            summary = '✅ Todas las instalaciones de accesibilidad están operativas.';
        }

        embed.setDescription(summary);

        // Dropdown will be used for details.


        return embed;
    }


    async _createEmbedForTab(cacheData) {
        const { station, metroData, currentTab } = cacheData;
        switch (currentTab) {
            case 'main':
                return this._createMainEmbed(station, metroData);
            case 'surroundings':
                return this._createSurroundingsEmbed(station);
            case 'accessibility':
            case 'acc_summary':
            case 'acc_elevators':
            case 'acc_escalators':
            case 'acc_accesses':
                return this._createAccessibilityEmbed(station, currentTab);
            default:
                return this._createMainEmbed(station, metroData);
        }
    }

    async formatStationInfo(station, metroInfoProvider, userId) {
        try {
            if (!station?.id) throw new Error('Invalid station data');

            const cacheKey = this._getCacheKey(station.id, userId);
            const metroData = metroInfoProvider.getFullData();
            const enrichedStation = this._enrichStationData(station);

            const cacheData = {
                station: enrichedStation,
                metroData: metroData,
                currentTab: 'main',
                timestamp: Date.now()
            };

            cacheManager.set(cacheKey, cacheData, CACHE_DURATION);
            return await this._createStationMessage(cacheData, userId);
        } catch (error) {
            console.error('[stationInfoButton] Build failed:', error);
            return await this._createErrorMessage('Error loading station data');
        }
    }

    _getStatusMapping(code) {
        const codeStr = (code || '1').toString();
        return metroConfig.statusMapping[codeStr] || metroConfig.statusMapping['1'];
    }

    _getColorForStatus(statusCode) {
        const code = parseInt(statusCode.toString());
        switch (code) {
            case 0: return '#95a5a6';
            case 1: return '#2ecc71';
            case 2: return '#e74c3c';
            case 3: return '#f39c12';
            case 4: return '#e67e22';
            case 5: return '#4CAF50';
            default: return '#95a5a6';
        }
    }

    formatStationStatus(station) {
        try {
            const enrichedStation = this._enrichStationData(station);
            const statusStyle = this._getStatusMapping(enrichedStation.status_data.js_code);
            const color = this._getColorForStatus(enrichedStation.status_data.js_code);

            const embed = new EmbedBuilder()
                .setTitle(`${metroConfig.linesEmojis[enrichedStation.line_id]} Estación ${enrichedStation.name || 'Desconocida'}`)
                .setColor(color)
                .setDescription(`**Estado:** ${statusStyle.emoji} ${statusStyle.message}`);

            let info = enrichedStation.status_data.status_message || 'No hay información adicional.';

            if (enrichedStation.transferLines && enrichedStation.transferLines.length > 0) {
                info += `\n**Combinación:** Con Línea(s) ${enrichedStation.transferLines.join(', ')}`;
            }
            embed.addFields({ name: '📌 Información', value: info });

            embed.setFooter({ text: `Última actualización: ${new Date(enrichedStation.last_renovation_date).toLocaleString()}` });

            return { embeds: [embed] };
        } catch (error) {
            console.error('STATION_EMBED_FAILED', { station: station?.id, error: error.message, stack: error.stack });
            return this._createErrorMessage(`Error al mostrar estación ${station?.name || 'desconocida'}`);
        }
    }
}

module.exports = DiscordMessageFormatter;
