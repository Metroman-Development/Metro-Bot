/**
 * @file successEmbed.js
 * @description Creates a standardized success embed.
 */

const { EmbedBuilder } = require('discord.js');

/**
 * Creates a success embed.
 * @param {object} data The data for the embed.
 * @param {string} data.message The success message to display.
 * @returns {EmbedBuilder} The created embed.
 */
function create({ message }) {
    return new EmbedBuilder()
        .setTitle('✅ Éxito')
        .setDescription(message)
        .setColor(0x2ECC71);
}

module.exports = {
    create,
};
