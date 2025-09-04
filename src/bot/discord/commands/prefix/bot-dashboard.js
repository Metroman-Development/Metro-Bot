const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');
const BaseCommand = require('../BaseCommand');

class BotDashboardCommand extends BaseCommand {
    constructor() {
        super({
            name: 'bot-dashboard',
            description: 'Gestión avanzada del bot con archivos, recarga de comandos y más.',
        });
    }

    async run(message) {
        if (!message.member.permissions.has('Administrator')) {
            return message.channel.send('❌ Solo los administradores pueden usar este comando.');
        }

        const filesDirectory = path.join(__dirname, '../slash');
        const files = fs.readdirSync(filesDirectory);

        const fileButtons = files.map(file => {
            return new ButtonBuilder()
                .setCustomId(`view_${file}`)
                .setLabel(file)
                .setStyle(ButtonStyle.Secondary);
        });

        const reloadButton = new ButtonBuilder()
            .setCustomId('reload_all')
            .setLabel('Recargar Comandos')
            .setStyle(ButtonStyle.Success);

        const rows = [];
        for (let i = 0; i < fileButtons.length; i += 5) {
            rows.push(new ActionRowBuilder().addComponents(fileButtons.slice(i, i + 5)));
        }

        rows.push(new ActionRowBuilder().addComponents(reloadButton));

        const embed = new EmbedBuilder()
            .setTitle('📂 Bot Dashboard')
            .setDescription('Usa los botones para ver, editar, gestionar archivos o recargar comandos.')
            .setColor('#00FF00');

        await message.channel.send({ embeds: [embed], components: rows });
    }
}

module.exports = new BotDashboardCommand();