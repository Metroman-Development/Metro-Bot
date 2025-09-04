const cacheManager = require('../../../utils/cacheManager');
const DiscordMessageFormatter = require('../../../formatters/DiscordMessageFormatter');
const StationEmbedHub = require('../../../templates/embeds/StationEmbedHub');

const CUSTOM_ID_PREFIX = 'stationInfo';
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

function _getCacheKey(stationId, userId) {
    return `${CUSTOM_ID_PREFIX}:${userId}:${stationId}`;
}

async function execute(interaction) {
    try {
        await interaction.deferUpdate();
    } catch (error) {
        if (error.code === 10062) {
            console.warn(`[stationInfoButton.js] Global handler caught an expired interaction. Code: ${error.code}. This is likely a race condition and can be ignored.`);
            return;
        }
        console.error('[stationInfoButton.js] Global handler failed to defer update:', error);
        return;
    }

    try {
        const [,,, stationId, tabId, userId] = interaction.customId.split(':');

        if (interaction.user.id !== userId) {
            return interaction.followUp({ content: 'No puedes interactuar con los botones de otra persona.', ephemeral: true });
        }

        const cacheKey = _getCacheKey(stationId, userId);
        const cacheData = cacheManager.get(cacheKey);

        if (!cacheData) {
            return interaction.editReply({
                content: 'Esta búsqueda ha expirado. Por favor, realiza una nueva búsqueda.',
                embeds: [],
                components: [],
            });
        }

        const embedHub = new StationEmbedHub({ config: require('../../../config/metro/metroConfig') });
        const isValidTab = embedHub.getAvailableTabs(cacheData.station).includes(tabId) ||
            tabId.startsWith('acc_');

        if (tabId && isValidTab) {
            cacheData.currentTab = tabId;
            cacheManager.set(cacheKey, cacheData, CACHE_DURATION);
        }

        const formatter = new DiscordMessageFormatter();
        const messagePayload = await formatter._createStationMessage(cacheData, userId);
        await interaction.editReply(messagePayload);
    } catch (error) {
        console.error('[stationInfoButton] Interaction failed:', error);
        await interaction.followUp({ content: 'Ocurrió un error al procesar la interacción.', ephemeral: true }).catch(e => { });
    }
}

module.exports = {
    customIdPrefix: CUSTOM_ID_PREFIX,
    execute,
};
