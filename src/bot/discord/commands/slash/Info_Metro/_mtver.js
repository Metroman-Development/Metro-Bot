const { SlashCommandBuilder } = require('discord.js');
const fareButtonsHandler = require('../../src/events/interactions/buttons/fareButtons');
const FareEmbed = require('../../../templates/embeds/FareEmbed');
const timeUtils = require('../../../utils/timeUtils');
const metroConfig = require('../../../../../config/metro/metroConfig');

module.exports = {
    parentCommand: 'tarifa',
    data: (subcommand) => subcommand
        .setName('ver')
        .setDescription('Muestra un panel interactivo con las tarifas del Metro.'),

    async execute(interaction) {
        try {
            await interaction.deferReply({ ephemeral: false });

            const initialFareType = 'metro';

            // --- Build Initial Embed ---
            const fareEmbedBuilder = new FareEmbed();
            const currentTime = timeUtils.getCurrentTime();
            const currentDay = timeUtils.getCurrentDay();
            const currentPeriod = timeUtils.getCurrentFarePeriod();
            const periodData = {
                period: currentPeriod.type,
                dayType: currentDay,
                nextChange: timeUtils.getNextTransition(),
                isEvent: false,
            };
            const initialEmbed = fareEmbedBuilder.createEnhanced(initialFareType, periodData, metroConfig.tarifario, true);

            // --- Build Initial Components ---
            const initialComponents = fareButtonsHandler.build(initialFareType);

            // --- Send Reply ---
            await interaction.editReply({
                embeds: [initialEmbed],
                components: initialComponents.components,
            });

        } catch (error) {
            console.error('Error en /tarifa ver:', error);
            await interaction.editReply({
                content: '❌ Error al crear el panel de tarifas.',
                ephemeral: true
            });
        }
    }
};
