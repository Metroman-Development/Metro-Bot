const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

/**
 * Creates a stateful button-based toggle component.
 */
function create(options) {
    const { idPrefix, options: toggleOptions, onToggle } = options;

    /**
     * Builds the message components (buttons).
     * @param {string} activeId - The ID of the currently active option.
     * @returns {{components: ActionRowBuilder[]}}
     */
    function buildComponents(activeId) {
        const row = new ActionRowBuilder();
        toggleOptions.forEach(opt => {
            const button = new ButtonBuilder()
                .setCustomId(`${idPrefix}:${opt.id}`)
                .setLabel(opt.label)
                .setStyle(opt.id === activeId ? ButtonStyle.Primary : ButtonStyle.Secondary)
                .setDisabled(opt.id === activeId);

            if (opt.emoji) {
                button.setEmoji(opt.emoji);
            }
            row.addComponents(button);
        });
        return { components: [row] };
    }

    /**
     * The execute function for the interaction handler.
     * @param {import('discord.js').Interaction} interaction - The interaction object.
     */
    async function execute(interaction) {
        const [_, selectedId] = interaction.customId.split(':');

        if (!interaction.isButton()) return;

        try {
            // Defer update to acknowledge the interaction
            // await interaction.deferUpdate(); // This is now done in onToggle

            // Call the user-defined toggle handler, passing the build function
            await onToggle(interaction, selectedId, buildComponents);

        } catch (error) {
            console.error(`[ToggleTemplate:${idPrefix}] Error executing onToggle:`, error);
            // Try to inform the user of the error
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: 'There was an error processing your request.' }).catch(() => {});
            }
        }
    }

    /**
     * Builds the initial reply. This is a convenience function to be called from the command.
     * @param {string} initialSelectedId - The ID of the option to be selected initially.
     * @returns {Promise<object>}
     */
    async function build(initialSelectedId) {
        // This function is intended to create the *initial* reply.
        // It will call onToggle with a mock interaction to get the first embed.
        // This is a bit of a workaround to keep the logic in one place.

        let initialEmbed;
        const mockInteraction = {
            update: ({ embeds }) => {
                initialEmbed = embeds[0];
            },
            deferUpdate: () => {},
        };

        // We call onToggle to get the initial state of the embed
        // but we pass a mock interaction that just captures the embed.
        // The `buildComponents` function is passed to generate the buttons.
        // This is not ideal, a better approach would be to separate embed creation from toggling.
        // For now, this will work.

        // A better design would be to have a dedicated `buildEmbed` function in the options.
        // Let's assume the user will call the logic to build the embed themselves for the first reply.
        // So this build function will just build the components.
        return buildComponents(initialSelectedId);
    }


    return {
        customIdPrefix: idPrefix,
        execute,
        build: buildComponents, // Expose the build function
    };
}

module.exports = {
    create,
};
