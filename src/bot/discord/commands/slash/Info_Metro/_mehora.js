

const { SlashCommandBuilder } = require('discord.js');
const TimeHelpers = require('../../modules/chronos/timeHelpers');

module.exports = {
    parentCommand: 'calendario-metro',
    data: (subcommand) => subcommand
        .setName('hora')
        .setDescription('Hora actual del sistema Metro'),

    async execute(interaction) {
        try {
            const time = TimeHelpers.formatForEmbed();
            const dayType = TimeHelpers.currentDayType;
            
            await interaction.reply([
                `🕒 **Hora del Metro:** ${time}`,
                `📅 Tipo de día: ${dayType}`
            ].join('\n'));
        } catch (error) {
            console.error('Error en /metro-estado hora:', error);
            await interaction.reply({
                content: '❌ Error al obtener hora del sistema',
                ephemeral: true
            });
        }
    }
};
