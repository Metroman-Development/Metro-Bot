const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const cacheManager = require('../../../utils/cacheManager');

const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

/**
 * Creates a tabbed interface using buttons.
 */
function create(options) {
    const { idPrefix, tabs, fetchTabData, buildEmbed } = options;

    async function build(interaction, context) {
        const userId = interaction.user.id;
        const initialTab = tabs[0].id;
        const cacheKey = `${idPrefix}:${userId}:${context.id || interaction.id}`;

        const tabData = await fetchTabData(initialTab, interaction, context);
        const embed = buildEmbed(tabData, initialTab);

        const cacheData = { userId, context };
        cacheManager.set(cacheKey, cacheData, CACHE_DURATION);

        const components = createTabButtons(cacheKey, initialTab);

        return { embeds: [embed], components };
    }

    function createTabButtons(cacheKey, activeTabId) {
        const row = new ActionRowBuilder();
        tabs.forEach(tab => {
            const button = new ButtonBuilder()
                .setCustomId(`${idPrefix}:${tab.id}:${cacheKey}`)
                .setLabel(tab.label)
                .setStyle(tab.id === activeTabId ? ButtonStyle.Primary : ButtonStyle.Secondary)
                .setDisabled(tab.id === activeTabId);
            if (tab.emoji) {
                button.setEmoji(tab.emoji);
            }
            row.addComponents(button);
        });
        return [row];
    }

    async function execute(interaction) {
        const [_, tabId, cacheKey] = interaction.customId.split(':');
        const cacheData = cacheManager.get(cacheKey);

        if (!cacheData || interaction.user.id !== cacheData.userId) {
            return interaction.update({ content: 'This interaction has expired or is not for you.', embeds: [], components: [] }).catch(() => {});
        }

        await interaction.deferUpdate();

        const tabData = await fetchTabData(tabId, interaction, cacheData.context);
        const embed = buildEmbed(tabData, tabId);
        const components = createTabButtons(cacheKey, tabId);

        await interaction.editReply({ embeds: [embed], components });
    }

    return {
        customIdPrefix: idPrefix,
        execute,
        build,
    };
}

module.exports = {
    create,
};
