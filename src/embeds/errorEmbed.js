/**
 * @file errorEmbed.js
 * @description Creates a standardized error embed.
 */

const { EmbedBuilder } = require('discord.js');

/**
 * Creates an error embed.
 * @param {object} data The data for the embed.
 * @param {string} data.message The error message to display.
 * @returns {EmbedBuilder} The created embed.
 */
function create({ message }) {
    return new EmbedBuilder()
        .setTitle('❌ Error')
        .setDescription(message)
        .setColor(0xFF0000);
}

module.exports = {
    create,
};
