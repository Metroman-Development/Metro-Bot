/**
 * @file embedFactory.js
 * @description A factory for creating standardized Discord embeds.
 */

const { EmbedBuilder } = require('discord.js');
const path = require('path');

const embedsDir = path.join(__dirname, '../embeds');

/**
 * Creates a standardized error embed.
 * @param {string} message The error message to display.
 * @returns {Promise<EmbedBuilder>} A promise that resolves to the created embed.
 */
function createErrorEmbed(message) {
    return createEmbed('error', { message });
}

/**
 * Creates a standardized success embed.
 * @param {string} message The success message to display.
 * @returns {Promise<EmbedBuilder>} A promise that resolves to the created embed.
 */
function createSuccessEmbed(message) {
    return createEmbed('success', { message });
}

/**
 * Creates an embed using a template from the /embeds directory.
 * @param {string} embedName The name of the embed template to use (e.g., 'stationInfo').
 * @param {object} data The data to pass to the embed template.
 * @returns {Promise<EmbedBuilder>} A promise that resolves to the created embed.
 * @throws {Error} If the embed template is not found or fails to execute.
 */
async function createEmbed(embedName, data) {
    const embedTemplatePath = path.join(embedsDir, `${embedName}Embed.js`);

    try {
        const embedTemplate = require(embedTemplatePath);
        return await embedTemplate.create(data);
    } catch (error) {
        console.error(`Error creating embed '${embedName}':`, error);
        return createErrorEmbed('No se pudo generar el contenido solicitado.');
    }
}

module.exports = {
    createEmbed,
    createErrorEmbed,
    createSuccessEmbed,
};
