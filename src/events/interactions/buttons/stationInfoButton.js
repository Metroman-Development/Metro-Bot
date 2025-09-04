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
        const [,,, stationId, tabId, userId] = interaction.customId.split(':');

        if (interaction.user.id !== userId) {
            return interaction.reply({ content: 'No puedes interactuar con los botones de otra persona.', ephemeral: true });
        }

        await interaction.deferUpdate();

        const cacheKey = _getCacheKey(stationId, userId);
        const cacheData = cacheManager.get(cacheKey);

        if (!cacheData) {
            return interaction.editReply({
                content: 'Esta búsqueda ha expirado. Por favor, realiza una nueva búsqueda.',
                embeds: [],
                components: [],
            }).catch(err => console.error("Error updating expired interaction:", err));
        }

        const embedHub = new StationEmbedHub({ config: require('../../../config/metro/metroConfig') });
        const isValidTab = embedHub.getAvailableTabs(cacheData.station).includes(tabId) ||
            tabId.startsWith('acc_');

        if (tabId && isValidTab) {
            cacheData.currentTab = tabId;
            cacheManager.set(cacheKey, cacheData, CACHE_DURATION);
        }

        const formatter = new DiscordMessageFormatter();
        await interaction.editReply(formatter._createStationMessage(cacheData, userId));
    } catch (error) {
        console.error('[stationInfoButton] Interaction failed:', error);
        await interaction.followUp({ content: 'Ocurrió un error al procesar la interacción.', ephemeral: true }).catch(e => { });
    }
}

module.exports = {
    customIdPrefix: CUSTOM_ID_PREFIX,
    execute,
};
