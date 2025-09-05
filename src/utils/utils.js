/*cnst { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const styles = require('../config/styles.json');
const { getCachedMetroData } = require('../events/metroDataHandler');
const { normalize } = require('./stringUtils');

/**
 * Prompts the user to confirm an action.
 * @param {Object} message - The message object.
 * @param {string} prompt - The confirmation prompt.
 * @returns {Promise<boolean>} - Resolves to `true` if the user confirms, otherwise `false`.
 */
async function confirmAction(message, prompt) {
    // Create confirmation embed
    const confirmEmbed = new EmbedBuilder()
        .setTitle('⚠️ Confirmación')
        .setDescription(prompt)
        .setColor(styles.defaultTheme?.warningColor || '#FFA500')
        .setFooter({ text: 'Responda con "y/yes" para confirmar o cualquier otra cosa para cancelar' });

    // Send the embed as a reply
    const sentMessage = await message.reply({ embeds: [confirmEmbed] });

    // Set up response collector
    const filter = response => response.author.id === message.author.id;
    const collector = message.channel.createMessageCollector({
        filter,
        time: 15000,
        max: 1
    });

    return new Promise((resolve) => {
        collector.on('collect', response => {
            // Delete user's response for privacy
            if (response.deletable) response.delete().catch(() => {});
            resolve(['y', 'yes'].includes(response.content.toLowerCase()));
        });

        collector.on('end', collected => {
            // Delete the confirmation prompt after resolution
            if (sentMessage.deletable) sentMessage.delete().catch(() => {});
            if (collected.size === 0) resolve(false);
        });
    });
}

/**
 * Checks if a station has a transfer.
 * @param {string} stationName - The name of the station (may include line suffix, e.g., "San Pablo L4A").
 * @returns {boolean} - Returns `true` if the station has a transfer, otherwise `false`.
 */
function isTransfer(stationName) {
    const metroData = getCachedMetroData();

    if (!metroData) {
        console.error('❌ metroData is undefined or could not be loaded.');
        return false;
    }

    // Remove line suffix (e.g., "San Pablo L4A" -> "San Pablo")
    const lineSuffixRegex = /(?:\s+|\b)(L\d+[a-zA-Z]*)$/i;
    const cleanedStationName = stationName.replace(lineSuffixRegex, '').trim();

    // Normalize the station name for comparison
    const normalizedStationName = normalize(cleanedStationName.toLowerCase());

    // Count occurrences of the station name and check transfer field
    let stationCount = 0;
    let hasTransfer = false;

    // Iterate through each line in metroData
    for (const lineKey in metroData) {
        const line = metroData[lineKey];
        if (line && line.stations) {
            // Find all stations in the current line's stations array
            const matchingStations = line.stations.filter(station =>
                normalize(station.name.toLowerCase()) === normalizedStationName
            );

            // Update station count and check transfer field
            matchingStations.forEach(station => {
                stationCount++;
                if (station.transfer && station.transfer.trim() !== "") {
                    hasTransfer = true;
                }
            });
        }
    }

    // A station is a transfer if:
    // 1. It appears at least twice in the metro data.
    // 2. It has a non-empty transfer field.
    return stationCount >= 2 && hasTransfer;
}

/**
 * Generates a unique interaction ID.
 * @returns {string} - A unique interaction ID.
 */
function generateInteractionId() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

/**
 * Creates a button with a custom ID and label.
 * @param {string} customId - The custom ID for the button.
 * @param {string} label - The label for the button.
 * @param {ButtonStyle} style - The style of the button.
 * @returns {ButtonBuilder} - The created button.
 */
function createButton(customId, label, style) {
    return new ButtonBuilder()
        .setCustomId(customId)
        .setLabel(label)
        .setStyle(style);
}

/**
 * Creates an ActionRowBuilder with buttons.
 * @param {Array<ButtonBuilder>} buttons - The buttons to add to the action row.
 * @returns {ActionRowBuilder} - The created action row.
 */
/*
function createActionRow(buttons) {
    return new ActionRowBuilder().addComponents(buttons);
}

module.exports = {
    confirmAction,
    isTransfer,
    generateInteractionId,
    createButton,
    createActionRow,
};


*/