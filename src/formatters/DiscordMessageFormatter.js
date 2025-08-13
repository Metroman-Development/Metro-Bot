const { ButtonStyle, ActionRowBuilder, ButtonBuilder, EmbedBuilder } = require('discord.js');
const cacheManager = require('../utils/cacheManager');
const metroConfig = require('../config/metro/metroConfig');
const StationEmbedHub = require('../templates/embeds/StationEmbedHub');

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

    _getLineColor(line) {
        return metroConfig.lineColors?.[line?.toLowerCase()] || 0x000000;
    }

    _getLineImage(line) {
        return `https://www.metro.cl/images/lines/line-${line || 'default'}.png`;
    }

    _createErrorMessage(message) {
        return {
            embeds: [new EmbedBuilder()
                .setTitle('⚠️ Error')
                .setDescription(message)
                .setColor(0xFF0000)
            ],
            components: [],
            ephemeral: true
        };
    }

    _enrichStationData(station, metro) {
        const staticData = metro?._staticData?.stations?.[station.displayName] ||
            metro?._staticData?.stations?.[station.id] || {};

        return {
            ...staticData,
            ...station,
            id: station.id,
            displayName: station.displayName || 'Unknown Station',
            line: station.line || 'L0',
            transferLines: station.transferLines || [],
            color: station.color || staticData.color || this._getLineColor(station.line),
            image: station.image || staticData.image || this._getLineImage(station.line)
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

    _createTabButtons(station, activeTab, metroData, userId) {
        const mainRow = new ActionRowBuilder();
        const accRow = new ActionRowBuilder();
        const embedHub = new StationEmbedHub({ config: metroConfig });
        const availableTabs = embedHub.getAvailableTabs(station);
        const hasAccessDetails = !!station.accessDetails;

        availableTabs.filter(t => !t.startsWith('acc_')).forEach(tabId => {
            const tabConfig = tabs[tabId];
            const isActive = tabId === activeTab;

            if (tabId === 'transfers' && station?.transferLines?.length > 0) {
                const transferStationId = this._getTransferStationId(station, metroData);
                if (transferStationId) return;
            }

            const button = new ButtonBuilder()
                .setCustomId(`${CUSTOM_ID_PREFIX}:view:${station.id}:${tabId}:${userId}`)
                .setStyle(isActive ? ButtonStyle.Primary : tabConfig.style)
                .setDisabled(isActive)
                .setEmoji(tabConfig.emoji);

            mainRow.addComponents(button);
        });

        if (station?.transferLines?.length > 0) {
            const transferStationId = this._getTransferStationId(station, metroData);
            if (transferStationId) {
                const lineKey = station.transferLines[0].toLowerCase();
                let emoji = null;

                if (metroConfig?.linesEmojis?.[lineKey]) {
                    const emojiString = metroConfig.linesEmojis[lineKey];
                    const matches = emojiString.match(/^<:(\w+):(\d+)>$/);

                    if (matches) {
                        emoji = {
                            id: matches[2],
                            name: matches[1]
                        };
                    }
                }

                const transferButton = new ButtonBuilder()
                    .setCustomId(`${CUSTOM_ID_PREFIX}:view:${transferStationId}:main:${userId}`)
                    .setLabel('🔄')
                    .setStyle(ButtonStyle.Success)
                    .setDisabled(false);

                if (emoji) {
                    transferButton.setEmoji(emoji);
                }

                mainRow.addComponents(transferButton);
            }
        }

        if (hasAccessDetails && availableTabs.includes('accessibility')) {
            const subTabs = availableTabs.filter(t => t.startsWith('acc_'));

            subTabs.forEach(subTabId => {
                const isActive = subTabId === activeTab;
                const tabConfig = tabs[subTabId];

                const button = new ButtonBuilder()
                    .setCustomId(`${CUSTOM_ID_PREFIX}:view:${station.id}:${subTabId}:${userId}`)
                    .setStyle(isActive ? ButtonStyle.Primary : tabConfig.style)
                    .setDisabled(isActive)
                    .setEmoji(tabConfig.emoji);

                accRow.addComponents(button);
            });
        }

        return [mainRow, accRow].filter(row => row.components.length > 0);
    }


    _createStationMessage(cacheData, userId) {
        if (!cacheData?.station) {
            return this._createErrorMessage('Station data unavailable');
        }

        try {
            const embedHub = new StationEmbedHub({ config: metroConfig });
            return {
                embeds: [embedHub.getEmbed(cacheData.currentTab, cacheData.station, cacheData.metroData)],
                components: this._createTabButtons(cacheData.station, cacheData.currentTab, cacheData.metroData, userId),
                fetchReply: true
            };
        } catch (error) {
            console.error('[stationInfoButton] Message creation failed:', error);
            return this._createErrorMessage('Error generating station info');
        }
    }

    formatStationInfo(station, metro, userId) {
        try {
            if (!station?.id) throw new Error('Invalid station data');

            const cacheKey = this._getCacheKey(station.id, userId);
            const metroData = metro?.api?.getProcessedData() || {};
            const enrichedStation = this._enrichStationData(station, metro);

            const cacheData = {
                station: enrichedStation,
                metroData: metroData,
                currentTab: 'main',
                timestamp: Date.now()
            };

            cacheManager.set(cacheKey, cacheData, CACHE_DURATION);
            return this._createStationMessage(cacheData, userId);
        } catch (error) {
            console.error('[stationInfoButton] Build failed:', error);
            return this._createErrorMessage('Error loading station data');
        }
    }

    _getStatusMapping(code) {
        const codeStr = code.toString();
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
            const statusStyle = this._getStatusMapping(station.status.code);
            const color = this._getColorForStatus(station.status.code);

            const embed = new EmbedBuilder()
                .setTitle(`${metroConfig.linesEmojis[station.line]} Estación ${station.name || 'Desconocida'}`)
                .setColor(color)
                .setDescription(`**Estado:** ${statusStyle.emoji} ${statusStyle.message}`);

            let info = station.status.appMessage || 'No hay información adicional.';
            if (station.transferLines && station.transferLines.length > 0) {
                // Simplified transfer logic
                info += `\n**Combinación:** Con Línea(s) ${station.transferLines.join(', ')}`;
            }
            embed.addFields({ name: '📌 Información', value: info });

            embed.setFooter({ text: `Última actualización: ${new Date(station.lastUpdated).toLocaleString()}` });

            return { embeds: [embed] };
        } catch (error) {
            console.error('STATION_EMBED_FAILED', { station: station?.id, error: error.message, stack: error.stack });
            return this._createErrorMessage(`Error al mostrar estación ${station?.name || 'desconocida'}`);
        }
    }
}

module.exports = DiscordMessageFormatter;
