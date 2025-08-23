const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const StatusEmbeds = require('../../../../../config/statusEmbeds');
const TimeHelpers = require('../../../../../utils/timeHelpers');

module.exports = {
    
    parentCommand: 'linea',
    data: (subcommand) => subcommand
        .setName('estado')
        .setDescription('Muestra el estado operacional de lineas')
        .addStringOption(option =>
    option.setName('linea')
        .setDescription('Selecciona una línea del Metro de Santiago')
        .setRequired(true)
        .addChoices(
            { name: '🚇 Línea 1', value: 'l1' },
            { name: '🚇 Línea 2', value: 'l2' },
            { name: '🚇 Línea 3', value: 'l3' },
            { name: '🚇 Línea 4', value: 'l4' },
            { name: '🚇 Línea 4A', value: 'l4a' },
            { name: '🚇 Línea 5', value: 'l5' },
            { name: '🚇 Línea 6', value: 'l6' }
        )
),
                

  async execute(interaction, metro) {
    try {
        await interaction.deferReply();
        const elementValue = interaction.options.getString('linea');
        const metroData = await metro.getCurrentData();
        const line = metroData.lines[elementValue];

        if (!line) {
            return await interaction.editReply({
                content: '❌ Línea no encontrada.',
                ephemeral: true
            });
        }
        
        const embedData = StatusEmbeds.lineEmbed(line, metroData.stations, TimeHelpers.currentTime.format('HH:mm'));
        const embed = new EmbedBuilder(embedData);
        await interaction.editReply({ embeds: [embed] });
        
    } catch (error) {
        console.error('Estado command failed:', error);
        await interaction.editReply({
            content: '❌ Error al procesar la solicitud',
            ephemeral: true
        });
    }
}
};