const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const cacheManager = require('../../../utils/cacheManager');

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Creates a navigation component, allowing users to move between different states/views.
 *
 * @param {object} options - The configuration for the navigation template.
 * @param {string} options.idPrefix - The prefix for the custom IDs.
 * @param {boolean} [options.validateUser=true] - Whether to restrict control to the initial user.
 * @param {Function} options.fetchState - An async function to fetch the initial state.
 * It receives a contextId (e.g., from the initial interaction).
 * @param {Function} options.buildEmbed - A function to build the embed for the current state.
 * It receives the current state data.
 * @param {Function} [options.buildComponents] - An optional function to build action rows for the current state.
 *
 * @returns {object} The interaction handler and a `build` function.
 */
function create(options) {
    const { idPrefix, validateUser = true, fetchState, buildEmbed, buildComponents } = options;

    async function build(interaction, contextId) {
        const userId = interaction.user.id;
        const cacheKey = `${idPrefix}:${userId}:${contextId || interaction.id}`;

        const state = await fetchState(contextId);
        state.history = []; // Initialize history

        cacheManager.set(cacheKey, { state, userId }, CACHE_DURATION);

        const embed = buildEmbed(state);
        const components = buildComponents ? buildComponents(state) : [];

        // Add back button if history is available
        if (state.history.length > 0) {
            const backButton = new ButtonBuilder()
                .setCustomId(`${idPrefix}:back:${cacheKey}`)
                .setLabel('Back')
                .setStyle(ButtonStyle.Secondary);

            if (components.length > 0) {
                components[components.length - 1].addComponents(backButton);
            } else {
                components.push(new ActionRowBuilder().addComponents(backButton));
            }
        }

        return { embeds: [embed], components };
    }

    async function execute(interaction) {
        const [_, action, cacheKey] = interaction.customId.split(':');
        let cacheData = cacheManager.get(cacheKey);

        if (!cacheData) {
            return interaction.update({ content: 'This interaction has expired.', embeds: [], components: [] }).catch(() => {});
        }

        if (validateUser && interaction.user.id !== cacheData.userId) {
            return interaction.reply({ content: 'You cannot control this navigation.' });
        }

        // Navigation logic here (e.g., back, forward, to a specific view)
        // For now, we only implement 'back' as per the example.
        if (action === 'back' && cacheData.state.history.length > 0) {
            // Pop from history to get the previous state
            const previousState = cacheData.state.history.pop();
            cacheData.state = { ...previousState, history: cacheData.state.history };
        } else {
            // Placeholder for other navigation actions
            // You would typically update the state here based on the action
        }

        cacheManager.set(cacheKey, cacheData, CACHE_DURATION);

        const embed = buildEmbed(cacheData.state);
        const components = buildComponents ? buildComponents(cacheData.state) : [];

        // Add back button if history is available
        if (cacheData.state.history.length > 0) {
             const backButton = new ButtonBuilder()
                .setCustomId(`${idPrefix}:back:${cacheKey}`)
                .setLabel('Back')
                .setStyle(ButtonStyle.Secondary);
            if (components.length > 0) {
                components[components.length - 1].addComponents(backButton);
            } else {
                components.push(new ActionRowBuilder().addComponents(backButton));
            }
        }

        await interaction.update({ embeds: [embed], components });
    }

    return {
        customIdPrefix: idPrefix,
        execute,
        build,
    };
}

/**
 * Creates a simple back button handler.
 * @param {string} targetPrefix - The idPrefix of the navigation component to go back to.
 */
function backButton(targetPrefix) {
    // This is a simplified concept. A real implementation would require
    // a more robust way to find the correct cache key for the target navigation.
    // For now, we return a placeholder handler.
    return {
        customIdPrefix: `back_to_${targetPrefix}`,
        async execute(interaction) {
            // In a real scenario, you'd need to find the parent navigation interaction
            // and trigger its 'back' action. This is non-trivial.
            await interaction.reply({ content: 'This functionality is not fully implemented yet.' });
        }
    };
}


module.exports = {
    create,
    backButton,
};
