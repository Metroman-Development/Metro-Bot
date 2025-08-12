const { ButtonStyle, ActionRowBuilder, ButtonBuilder, EmbedBuilder } = require('discord.js');
const cacheManager = require('../../../utils/cacheManager');
const metroConfig = require('../../../../config/metro/metroConfig');
const StationEmbedHub = require('../../../../templates/embeds/StationEmbedHub');

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

// --- Helper Functions ---

function _getCacheKey(stationId, userId) {
    return `${CUSTOM_ID_PREFIX}:${userId}:${stationId}`;
}

function _getLineColor(line) {
    return metroConfig.lineColors?.[line?.toLowerCase()] || 0x000000;
}

function _getLineImage(line) {
    return `https://www.metro.cl/images/lines/line-${line || 'default'}.png`;
}

function _createErrorMessage(message) {
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

function _enrichStationData(station, metro) {
    const staticData = metro?._staticData?.stations?.[station.displayName] ||
                     metro?._staticData?.stations?.[station.id] || {};

    return {
        ...staticData,
        ...station,
        id: station.id,
        displayName: station.displayName || 'Unknown Station',
        line: station.line || 'L0',
        transferLines: station.transferLines || [],
        color: station.color || staticData.color || _getLineColor(station.line),
        image: station.image || staticData.image || _getLineImage(station.line)
    };
}

function _findTransferStation(currentStation, line, metroData) {
    if (!line || !currentStation?.displayName) return null;

    const baseName = currentStation.displayName.replace(/\s(L\d+[a-z]?)$/i, '').trim();
    const transferDisplayName = `${baseName} ${line.toUpperCase()}`;

    return Object.values(metroData.stations || {})
               .find(s => s?.displayName === transferDisplayName);
}

function _getTransferStationId(currentStation, metroData) {
    if (!currentStation?.transferLines?.length) return null;
    const transferStation = _findTransferStation(currentStation, currentStation.transferLines[0], metroData);
    return transferStation?.id;
}

function _createTabButtons(station, activeTab, metroData, userId) {
    const mainRow = new ActionRowBuilder();
    const accRow = new ActionRowBuilder();
    const embedHub = new StationEmbedHub({ config: metroConfig });
    const availableTabs = embedHub.getAvailableTabs(station);
    const hasAccessDetails = !!station.accessDetails;

    availableTabs.filter(t => !t.startsWith('acc_')).forEach(tabId => {
        const tabConfig = tabs[tabId];
        const isActive = tabId === activeTab;

        if (tabId === 'transfers' && station?.transferLines?.length > 0) {
            const transferStationId = _getTransferStationId(station, metroData);
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
        const transferStationId = _getTransferStationId(station, metroData);
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


function _createStationMessage(cacheData, userId) {
    if (!cacheData?.station) {
        return _createErrorMessage('Station data unavailable');
    }

    try {
        const embedHub = new StationEmbedHub({ config: metroConfig });
        return {
            embeds: [embedHub.getEmbed(cacheData.currentTab, cacheData.station, cacheData.metroData)],
            components: _createTabButtons(cacheData.station, cacheData.currentTab, cacheData.metroData, userId),
            fetchReply: true
        };
    } catch (error) {
        console.error('[stationInfoButton] Message creation failed:', error);
        return _createErrorMessage('Error generating station info');
    }
}


// --- Exported Functions ---

/**
 * Builds the initial response for the station info command.
 */
function buildStationInfoReply(station, metro, userId) {
    try {
        if (!station?.id) throw new Error('Invalid station data');

        const cacheKey = _getCacheKey(station.id, userId);
        const metroData = metro?.api?.getProcessedData() || {};
        const enrichedStation = _enrichStationData(station, metro);

        const cacheData = {
            station: enrichedStation,
            metroData: metroData,
            currentTab: 'main',
            timestamp: Date.now()
        };

        cacheManager.set(cacheKey, cacheData, CACHE_DURATION);
        return _createStationMessage(cacheData, userId);
    } catch (error) {
        console.error('[stationInfoButton] Build failed:', error);
        return _createErrorMessage('Error loading station data');
    }
}

/**
 * The main execution function for handling button interactions for station info.
 */
async function execute(interaction) {
    try {
        const [,,, stationId, tabId, userId] = interaction.customId.split(':');

        if (interaction.user.id !== userId) {
            return interaction.reply({ content: 'No puedes interactuar con los botones de otra persona.', ephemeral: true });
        }

        const cacheKey = _getCacheKey(stationId, userId);
        const cacheData = cacheManager.get(cacheKey);

        if (!cacheData) {
            return interaction.update({
                content: 'Esta búsqueda ha expirado. Por favor, realiza una nueva búsqueda.',
                embeds: [],
                components: [],
            }).catch(err => console.error("Error updating expired interaction:", err));
        }

        const embedHub = new StationEmbedHub({ config: metroConfig });
        const isValidTab = embedHub.getAvailableTabs(cacheData.station).includes(tabId) ||
                         tabId.startsWith('acc_');

        if (tabId && isValidTab) {
            cacheData.currentTab = tabId;
            cacheManager.set(cacheKey, cacheData, CACHE_DURATION);
        }

        await interaction.update(_createStationMessage(cacheData, userId));
    } catch (error) {
        console.error('[stationInfoButton] Interaction failed:', error);
        await interaction.followUp({ content: 'Ocurrió un error al procesar la interacción.', ephemeral: true }).catch(e => {});
    }
}

module.exports = {
    customIdPrefix: CUSTOM_ID_PREFIX,
    execute,
    buildStationInfoReply,
};
