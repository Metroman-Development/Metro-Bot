const { ActionRowBuilder, ButtonBuilder, StringSelectMenuBuilder, ButtonStyle } = require('discord.js');

/**
 * Creates a component for selecting one item from a list of options.
 * This can be rendered as either buttons or a select menu.
 *
 * @param {object} options - The configuration for the selection template.
 * @param {string} options.idPrefix - The prefix for the custom IDs.
 * @param {'buttons' | 'menu'} options.style - The rendering style.
 * @param {Function} options.fetchOptions - An async function that returns an array of options.
 * Each option should be an object with `label`, `value`, and optionally `emoji` and `description`.
 * @param {Function} options.onSelect - An async function called when an option is selected.
 * It receives the interaction and the `value` of the selected option.
 *
 * @returns {object} An object containing a `build` function and the interaction handler.
 */
function create(options) {
    const { idPrefix, style, fetchOptions, onSelect } = options;

    /**
     * Builds the initial message payload with the selection component.
     * @returns {Promise<{components: ActionRowBuilder[]}>}
     */
    async function build() {
        const a_options = await fetchOptions();
        const row = new ActionRowBuilder();

        if (style === 'buttons') {
            a_options.forEach(opt => {
                const button = new ButtonBuilder()
                    .setCustomId(`${idPrefix}:${opt.value}`)
                    .setLabel(opt.label)
                    .setStyle(ButtonStyle.Secondary);
                if (opt.emoji) button.setEmoji(opt.emoji);
                row.addComponents(button);
            });
        } else { // style === 'menu'
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId(idPrefix)
                .setPlaceholder('Select an option')
                .addOptions(a_options.map(opt => ({
                    label: opt.label,
                    value: opt.value,
                    description: opt.description,
                    emoji: opt.emoji,
                })));
            row.addComponents(selectMenu);
        }
        return { components: [row] };
    }

    async function execute(interaction) {
        try {
            await interaction.deferUpdate();

            let selectedValue;
            if (interaction.isButton()) {
                selectedValue = interaction.customId.split(':')[1];
            } else if (interaction.isStringSelectMenu()) {
                selectedValue = interaction.values[0];
            } else {
                return;
            }

            await onSelect(interaction, selectedValue);

        } catch (error) {
            console.error(`[SelectionTemplate:${idPrefix}] Error executing onSelect:`, error);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: 'There was an error processing your selection.', ephemeral: true }).catch(() => {});
            }
        }
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
