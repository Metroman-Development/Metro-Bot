const cacheManager = require('./cacheManager');
const DiscordMessageFormatter = require('../formatters/DiscordMessageFormatter');

/**
 * Creates and manages a message component collector for station information embeds.
 * @param {import('discord.js').Message} message The message to attach the collector to.
 * @param {import('discord.js').Interaction} interaction The original interaction.
 */
function createStationInfoCollector(message, interaction) {
    const collector = message.createMessageComponentCollector({
        filter: i => i.user.id === interaction.user.id,
        time: 300000 // 5 minutes
    });

    collector.on('collect', async i => {
        try {
            await i.deferUpdate();
            let tab;
            let stationId;

            if (i.isStringSelectMenu()) {
                const selectedValue = i.values[0];
                [, stationId, tab] = selectedValue.split(':');
            } else {
                [, stationId, tab] = i.customId.split(':');
            }

            const formatter = new DiscordMessageFormatter();
            const cacheKey = formatter._getCacheKey(stationId, i.user.id);
            const cacheData = cacheManager.get(cacheKey);

            if (cacheData) {
                cacheData.currentTab = tab;
                cacheManager.set(cacheKey, cacheData);

                const newMessagePayload = await formatter._createStationMessage(cacheData, i.user.id);
                await i.editReply(newMessagePayload);
            }
        } catch (error) {
            if (error.code === 10062) {
                console.warn(`[collectorManager.js] Collector caught an expired interaction. Code: ${error.code}. This is likely a race condition and can be ignored.`);
                return;
            }
            console.error('[collectorManager.js] Collector failed:', error);
        }
    });

    collector.on('end', collected => {
        const lastInteraction = collected.last();
        if (lastInteraction) {
            const disabledPayload = { ...lastInteraction.message, components: [] };
            interaction.editReply(disabledPayload).catch(err => {
                if (err.code !== 10008) { // Unknown Message
                    console.error("Failed to disable components on collector end:", err);
                }
            });
        }
    });
}

module.exports = {
    createStationInfoCollector,
};
