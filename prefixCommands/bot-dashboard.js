const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
    name: 'bot-dashboard',
    description: 'Gestión avanzada del bot con archivos, recarga de comandos y más.',
    execute: async (message, args, client) => {
        if (!message.member.permissions.has('Administrator')) {
            return message.channel.send('❌ Solo los administradores pueden usar este comando.');
        }

        const filesDirectory = path.join(__dirname, '../slashCommands'); // Change directory to your commands directory
        const files = fs.readdirSync(filesDirectory);

        // Generate a list of files as buttons
        const fileButtons = files.map(file => {
            return new ButtonBuilder()
                .setCustomId(`view_${file}`)
                .setLabel(file)
                .setStyle(ButtonStyle.Secondary);
        });

        // Add a global reload button
        const reloadButton = new ButtonBuilder()
            .setCustomId('reload_all')
            .setLabel('Recargar Comandos')
            .setStyle(ButtonStyle.Success);

        // Chunk buttons into rows (max 5 per row)
        const rows = [];
        for (let i = 0; i < fileButtons.length; i += 5) {
            rows.push(new ActionRowBuilder().addComponents(fileButtons.slice(i, i + 5)));
        }

        // Add the reload button as the last row
        rows.push(new ActionRowBuilder().addComponents(reloadButton));

        const embed = new EmbedBuilder()
            .setTitle('📂 Bot Dashboard')
            .setDescription('Usa los botones para ver, editar, gestionar archivos o recargar comandos.')
            .setColor('#00FF00');

        // Send the embed with buttons
        await message.channel.send({ embeds: [embed], components: rows });
    }
};