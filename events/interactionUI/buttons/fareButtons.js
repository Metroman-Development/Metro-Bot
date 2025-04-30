// events/interactionUI/buttons/fareButtons.js
const { createFareEmbed } = require('../../../config/defaultEmbeds/fareEmbeds');
const { getCurrentDay, getCurrentTime, getCurrentFarePeriod } = require('../../../utils/timeUtils');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    customId: 'fareButtons_', // Prefix for all buttons in this file

    execute: async (interaction, client) => {
        // Extract userId, embedId, and action from the customId
        const [prefix, userId, embedId, action] = interaction.customId.split('_');

        // Get the current time, day, and fare period
        const currentTime = getCurrentTime();
        const currentDay = getCurrentDay();
        const currentPeriod = getCurrentFarePeriod();

        // Create the embed based on the action
        const embed = createFareEmbed(action, currentDay, currentTime, currentPeriod);

        // Recreate the buttons to include in the updated interaction
        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`fareButtons_${userId}_${embedId}_metro`) // Custom ID with prefix, userId_embedId, and action
                .setEmoji('🚇')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`fareButtons_${userId}_${embedId}_combinacion`) // Custom ID with prefix, userId_embedId, and action
                .setEmoji('🔄')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`fareButtons_${userId}_${embedId}_estudiante`) // Custom ID with prefix, userId_embedId, and action
                .setEmoji('🎓')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`fareButtons_${userId}_${embedId}_adulto`) // Custom ID with prefix, userId_embedId, and action
                .setEmoji('👴')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`fareButtons_${userId}_${embedId}_adultobip`) // Custom ID with prefix, userId_embedId, and action
                .setEmoji('💳')
                .setStyle(ButtonStyle.Primary)
        );

        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`fareButtons_${userId}_${embedId}_transantiago`) // Custom ID with prefix, userId_embedId, and action
                .setEmoji('🚌')
                .setStyle(ButtonStyle.Primary)
        );

        // Send the initial embed with buttons
        await interaction.editReply({
            embeds: [embed],
            components: [row1, row2], // Include the buttons to keep them visible
        });

        // Set a timeout to remove the buttons after 5 minutes
        setTimeout(async () => {
            try {
                // Remove the buttons after the timeout
                await interaction.editReply({ components: [] });
                console.log(`Buttons removed for ${userId}_${embedId} after 5 minutes.`);
            } catch (error) {
                console.error(`Error removing buttons for ${userId}_${embedId}:`, error);
            }
        }, 5 * 60 * 1000); // 5 minutes in milliseconds
    },
};