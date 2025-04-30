const { ButtonStyle, ActionRowBuilder, ButtonBuilder, EmbedBuilder } = require('discord.js');
const BaseButton = require('./templates/baseButton');
const interactionStore = require('../utils/interactionStore');
const StationEmbedHub = require('../../../templates/embeds/StationEmbedHub');
const metroConfig = require('../../../config/metro/metroConfig');

class StationInfoButton extends BaseButton {
    constructor(metroCore) {
        super({
            customIdPrefix: 'stationInfo',
            style: ButtonStyle.Secondary,
            requiresDefer: true,
            ephemeral: false
        });

        this.metro = metroCore || { config: metroConfig };
        if (!this.metro.config) {
            this.metro.config = metroConfig;
        }

        this.cacheDuration = 15 * 60 * 1000;
        this._cachingInProgress = new Set();
        this.embedHub = new StationEmbedHub(this.metro);

        this.tabs = {
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
    }

    async build(station, metro) {
        try {
            if (!station?.id) throw new Error('Invalid station data');
            
            const cacheKey = this._getCacheKey(station.id);
            const metroData = metro?.api?.getProcessedData() || {};
            const enrichedStation = this._enrichStationData(station, metro);

            if (enrichedStation.transferLines?.length > 0) {
                await this._cacheTransferStations(enrichedStation, metro, metroData);
            }

            const cacheData = {
                station: enrichedStation,
                metroData: metroData,
                currentTab: 'main',
                timestamp: Date.now()
            };

            interactionStore.set(cacheKey, cacheData, this.cacheDuration);
            return this._createStationMessage(cacheData);
        } catch (error) {
            console.error('[StationInfoButton] Build failed:', error);
            return this._createErrorMessage('Error loading station data');
        }
    }

    _createStationMessage(cacheData) {
        if (!cacheData?.station) {
            return this._createErrorMessage('Station data unavailable');
        }

        try {
            return {
                embeds: [this.embedHub.getEmbed(cacheData.currentTab, cacheData.station, cacheData.metroData)],
                components: this._createTabButtons(cacheData.station, cacheData.currentTab, cacheData.metroData),
                fetchReply: true
            };
        } catch (error) {
            console.error('[StationInfoButton] Message creation failed:', error);
            return this._createErrorMessage('Error generating station info');
        }
    }

    _createTabButtons(station, activeTab, metroData) {
    const mainRow = new ActionRowBuilder();
    const accRow = new ActionRowBuilder();
    const availableTabs = this.embedHub.getAvailableTabs(station);
    const hasAccessDetails = !!station.accessDetails;

    // Main navigation buttons
    availableTabs.filter(t => !t.startsWith('acc_')).forEach(tabId => {
        const tabConfig = this.tabs[tabId];
        const isActive = tabId === activeTab;

        // Skip transfers tab if we're going to create a direct transfer button
        if (tabId === 'transfers' && station?.transferLines?.length > 0) {
            const transferStationId = this._getTransferStationId(station, metroData);
            if (transferStationId) return; // We'll handle this specially below
        }

        const button = new ButtonBuilder()
            .setCustomId(`stationInfo:view:${station.id}:${tabId}`)
            .setStyle(isActive ? ButtonStyle.Primary : tabConfig.style)
            .setDisabled(isActive)
            .setEmoji(tabConfig.emoji);

        mainRow.addComponents(button);
    });

    // Add direct transfer button if available
    if (station?.transferLines?.length > 0) {
        const transferStationId = this._getTransferStationId(station, metroData);
        if (transferStationId) {
            const lineKey = station.transferLines[0].toLowerCase();
            let emoji = null;
            
            if (this.metro.config?.linesEmojis?.[lineKey]) {
                const emojiString = this.metro.config.linesEmojis[lineKey];
                const matches = emojiString.match(/^<:(\w+):(\d+)>$/);
                
                if (matches) {
                    emoji = {
                        id: matches[2],
                        name: matches[1]
                    };
                }
            }

            const transferButton = new ButtonBuilder()
                .setCustomId(`stationInfo:view:${transferStationId}:main`)
                .setLabel('🔄')
                .setStyle(ButtonStyle.Success)
                .setDisabled(false);

            if (emoji) {
                transferButton.setEmoji(emoji);
            }

            mainRow.addComponents(transferButton);
        }
    }

    // Accessibility sub-buttons
    if (hasAccessDetails && availableTabs.includes('accessibility')) {
        const subTabs = availableTabs.filter(t => t.startsWith('acc_'));
        
        subTabs.forEach(subTabId => {
            const isActive = subTabId === activeTab;
            const tabConfig = this.tabs[subTabId];

            const button = new ButtonBuilder()
                .setCustomId(`stationInfo:view:${station.id}:${subTabId}`)
                .setStyle(isActive ? ButtonStyle.Primary : tabConfig.style)
                .setDisabled(isActive)
                .setEmoji(tabConfig.emoji);

            accRow.addComponents(button);
        });
    }

    return [mainRow, accRow].filter(row => row.components.length > 0);
}

    _getTransferStationId(currentStation, metroData) {
    if (!currentStation?.transferLines?.length) return null;
    const transferStation = this._findTransferStation(currentStation, currentStation.transferLines[0], metroData);
    return transferStation?.id;
}

    _findTransferStation(currentStation, line, metroData) {
    if (!line || !currentStation?.displayName) return null;
    
    const baseName = currentStation.displayName.replace(/\s(L\d+[a-z]?)$/i, '').trim();
    const transferDisplayName = `${baseName} ${line.toUpperCase()}`;
    
    return Object.values(metroData.stations || {})
               .find(s => s?.displayName === transferDisplayName);
}

    async _cacheTransferStations(currentStation, metro, metroData) {
        if (!currentStation?.id || this._cachingInProgress.has(currentStation.id)) return;

        this._cachingInProgress.add(currentStation.id);
        try {
            for (const transferLine of currentStation.transferLines || []) {
                const transferStation = this._findTransferStation(currentStation, transferLine, metroData);
                if (!transferStation) continue;

                const transferCacheKey = this._getCacheKey(transferStation.id);
                if (!interactionStore.get(transferCacheKey)) {
                    interactionStore.set(
                        transferCacheKey,
                        {
                            station: this._enrichStationData(transferStation, metro),
                            metroData: metroData,
                            currentTab: 'main',
                            timestamp: Date.now()
                        },
                        this.cacheDuration
                    );
                }
            }
        } finally {
            this._cachingInProgress.delete(currentStation.id);
        }
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

    async handleInteraction(interaction) {
    try {
        const [,, stationId, tabId] = interaction.customId.split(':');
        const cacheKey = this._getCacheKey(stationId);
        const cacheData = interactionStore.get(cacheKey);

        if (!cacheData) {
            return interaction.editReply(this._createErrorMessage('Session expired'));
        }

        // Validate tab against available tabs OR accessibility sub-tabs
        const isValidTab = this.embedHub.getAvailableTabs(cacheData.station).includes(tabId) || 
                         tabId.startsWith('acc_');

        if (tabId && isValidTab) {
            // Handle accessibility sub-tabs
            if (tabId.startsWith('acc_')) {
                cacheData.currentTab = tabId;
                // Ensure parent tab is marked as active
                interactionStore.set(cacheKey, {
                    ...cacheData,
                    currentTab: tabId
                }, this.cacheDuration);
            } else {
                cacheData.currentTab = tabId;
                interactionStore.set(cacheKey, cacheData, this.cacheDuration);
            }
        }

        await interaction.editReply(this._createStationMessage(cacheData));
    } catch (error) {
        console.error('[StationInfoButton] Interaction failed:', error);
        await interaction.editReply(this._createErrorMessage('Processing error'));
    }
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

    _getCacheKey(stationId) {
        return `station_${stationId}`;
    }

    _getLineColor(line) {
        return metroConfig.lineColors?.[line?.toLowerCase()] || 0x000000;
    }

    _getLineImage(line) {
        return `https://www.metro.cl/images/lines/line-${line || 'default'}.png`;
    }
    
    
}

module.exports = StationInfoButton;
