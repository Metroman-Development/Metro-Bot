const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const cacheManager = require('../../../utils/cacheManager');

const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

/**
 * Creates a pagination component that can be used for navigating through a list of items.
 *
 * @param {object} options - The configuration for the pagination template.
 * @param {string} options.idPrefix - The prefix for the custom IDs of the buttons.
 * @param {Function} options.fetchData - An async function to fetch the data for a given page.
 * It receives the page number (0-indexed). It should return an object with `items` and `totalPages`.
 * @param {Function} options.buildEmbed - A function to build the embed for the current page's data.
 * It receives an object with `items`, `currentPage`, and `totalPages`.
 *
 * @returns {object} An object containing functions to build the initial reply and the interaction handler.
 */
function create(options) {
    const { idPrefix, fetchData, buildEmbed } = options;

    /**
     * Builds the initial reply for the pagination component.
     * @param {import('discord.js').Interaction} interaction - The interaction to reply to.
     * @returns {Promise<object>>} A promise that resolves to the message payload.
     */
    async function build(interaction) {
        const userId = interaction.user.id;
        const cacheKey = `${idPrefix}:${userId}:${interaction.id}`;

        const { items, totalPages } = await fetchData(0);

        const cacheData = {
            currentPage: 0,
            totalPages,
            userId,
        };
        cacheManager.set(cacheKey, cacheData, CACHE_DURATION);

        const embed = buildEmbed({ items, currentPage: 0, totalPages });
        const components = createPaginationButtons(cacheKey, cacheData);

        return { embeds: [embed], components, ephemeral: false };
    }

    function createPaginationButtons(cacheKey, cacheData) {
        const { currentPage, totalPages } = cacheData;
        if (totalPages <= 1) return [];

        return [new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`${idPrefix}:prev:${cacheKey}`)
                .setLabel('◀ Anterior')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(currentPage === 0),
            new ButtonBuilder()
                .setCustomId(`${idPrefix}:page:${cacheKey}`)
                .setLabel(`${currentPage + 1}/${totalPages}`)
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true),
            new ButtonBuilder()
                .setCustomId(`${idPrefix}:next:${cacheKey}`)
                .setLabel('Siguiente ▶')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(currentPage >= totalPages - 1)
        )];
    }

    async function execute(interaction) {
        const [_, action, cacheKey] = interaction.customId.split(':');
        let cacheData = cacheManager.get(cacheKey);

        if (!cacheData) {
            return interaction.update({
                content: 'Esta interacción ha expirado. Por favor, realiza una nueva búsqueda.',
                embeds: [],
                components: [],
            }).catch(() => {});
        }

        if (interaction.user.id !== cacheData.userId) {
            return interaction.reply({ content: 'No puedes controlar los resultados de búsqueda de otra persona.', ephemeral: true });
        }

        switch (action) {
            case 'prev':
                cacheData.currentPage = Math.max(0, cacheData.currentPage - 1);
                break;
            case 'next':
                cacheData.currentPage = Math.min(cacheData.totalPages - 1, cacheData.currentPage + 1);
                break;
            default:
                return interaction.deferUpdate();
        }

        const { items } = await fetchData(cacheData.currentPage);
        const embed = buildEmbed({ items, currentPage: cacheData.currentPage, totalPages: cacheData.totalPages });
        const components = createPaginationButtons(cacheKey, cacheData);

        cacheManager.set(cacheKey, cacheData, CACHE_DURATION);

        await interaction.update({ embeds: [embed], components });
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
