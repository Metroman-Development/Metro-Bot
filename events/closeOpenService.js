const { EmbedBuilder } = require('discord.js');
const metroConfig = require('../config/metroConfig.js'); // Import configuration file
const { getCachedMetroData } = require('./metroDataHandler.js'); // Import getCachedMetroData

// Function to handle 11 PM closing announcement
async function handleClosingAnnouncement(client) {
    const now = new Date().toLocaleString('en-US', { timeZone: 'America/Santiago' });
    const chileHour = new Date(now).getHours();
    const chileMinute = new Date(now).getMinutes();

    // Check if it's 11:00 PM (23:00) and 5 seconds
    if (chileHour === 23 && chileMinute === 0) {
        setTimeout(async () => {
            const data = getCachedMetroData(); // Use getCachedMetroData
            if (!data) return;

            const alertChannel = await client.channels.fetch(metroConfig.alertChannelId);
            if (!alertChannel) return;

            // Check for lines/stations that are still open
            const closedLines = [];
            for (const key in data) {
                const line = data[key];
                if (line.estado !== '0') { // If the line is not closed
                    closedLines.push(`Línea ${key.toUpperCase()}`);
                }
            }

            // Create the closing embed
            const closingEmbed = new EmbedBuilder()
                .setTitle('🚇 Cierre del Metro de Santiago')
                .setColor(metroConfig.defaultColor) // Default color
                .setDescription(closedLines.length > 0 ?
                    `Se ha iniciado el cierre del Metro. Las siguientes líneas aún están operativas:\n${closedLines.join('\n')}` :
                    'Se ha iniciado el cierre del Metro. Toda la red está cerrada.')
                .setTimestamp();

            await alertChannel.send({ embeds: [closingEmbed] });
            console.log('✅ 11 PM closing announcement sent.');
        }, 5000); // Wait 5 seconds
    }
}

// Function to handle 6 AM opening announcement
async function handleOpeningAnnouncement(client) {
    const now = new Date().toLocaleString('en-US', { timeZone: 'America/Santiago' });
    const chileHour = new Date(now).getHours();
    const chileMinute = new Date(now).getMinutes();

    // Check if it's 6:00 AM and 5 seconds
    if (chileHour === 6 && chileMinute === 0) {
        setTimeout(async () => {
            const data = getCachedMetroData(); // Use getCachedMetroData
            if (!data) return;

            const alertChannel = await client.channels.fetch(metroConfig.alertChannelId);
            if (!alertChannel) return;

            // Check for lines/stations that are still closed
            const closedLines = [];
            for (const key in data) {
                const line = data[key];
                if (line.estado !== '1') { // If the line is not operational
                    closedLines.push(`Línea ${key.toUpperCase()}`);
                }
            }

            // Create the opening embed
            const openingEmbed = new EmbedBuilder()
                .setTitle('🚇 Inicio de la Jornada en Metro de Santiago')
                .setColor(metroConfig.defaultColor) // Default color
                .setDescription(closedLines.length > 0 ?
                    `Se inicia la jornada en Metro de Santiago. Las siguientes líneas están cerradas:\n${closedLines.join('\n')}` :
                    'Se inicia la jornada en Metro de Santiago. Toda la red está habilitada.')
                .setTimestamp();

            await alertChannel.send({ embeds: [openingEmbed] });
            console.log('✅ 6 AM opening announcement sent.');
        }, 5000); // Wait 5 seconds
    }
}

module.exports = {
    handleClosingAnnouncement,
    handleOpeningAnnouncement,
};



