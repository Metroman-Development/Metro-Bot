const ToggleTemplate = require('../templates/toggle');
const FareEmbed = require('../../../templates/embeds/FareEmbed');
const timeUtils = require('../../../utils/timeHelpers.js');
const metroConfig = require('../../../config/metro/metroConfig');

// This is the new interaction handler for fare buttons.
// It uses the ToggleTemplate to manage the button state and interaction logic.

module.exports = ToggleTemplate.create({
    idPrefix: 'fare_type',

    // Define the different fare types as toggle options
    options: [
        { id: 'metro', label: 'Normal', emoji: '🚇' },
        { id: 'combinacion', label: 'Combinada', emoji: '🔄' },
        { id: 'estudiante', label: 'Estudiante', emoji: '🎓' },
        { id: 'adulto', label: 'Adulto Mayor', emoji: '👴' },
        { id: 'adultobip', label: 'BIP!', emoji: '💳' },
        { id: 'transantiago', label: 'Red', emoji: '🚌' },
    ],

    /**
     * This function is called when a user clicks one of the fare buttons.
     * @param {import('discord.js').Interaction} interaction - The button interaction.
     * @param {string} selectedId - The `id` of the selected fare type.
     * @param {Function} buildComponents - A function to rebuild the buttons with the new active state.
     */
    async onToggle(interaction, selectedId, buildComponents) {
        // Get current time and fare period data
        const currentTime = timeUtils.getCurrentTime();
        const currentDay = timeUtils.getCurrentDay();
        const currentPeriod = timeUtils.getCurrentFarePeriod();

        // The data needed by the embed
        const periodData = {
            period: currentPeriod.type,
            dayType: currentDay,
            nextChange: timeUtils.getNextTransition(),
            isEvent: false, // Assuming no event by default
        };

        // Instantiate the embed builder
        const fareEmbedBuilder = new FareEmbed();

        // Create the new embed
        const newEmbed = fareEmbedBuilder.createEnhanced(selectedId, periodData, metroConfig.tarifario, true);

        // Rebuild the buttons to reflect the new selection
        const newComponents = buildComponents(selectedId);

        // Update the original message with the new embed and buttons
        await interaction.update({
            embeds: [newEmbed],
            components: newComponents.components,
        });
    }
});
