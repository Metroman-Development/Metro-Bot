const { SlashCommandBuilder } = require('discord.js');
const ExpresoButton = require('../../modules/interactions/buttons/ExpresoButton');

const expresoButton = new ExpresoButton();

module.exports = {
    parentCommand: 'expreso',
    data: (subcommand) => subcommand
        .setName('info')
        .setDescription('Muestra información sobre las rutas expresas')
        .addStringOption(option =>
            option.setName('linea')
                .setDescription('Selecciona una línea para ver sus rutas expresas')
                .setRequired(true)
                .addChoices(
                    { name: '🚇 Línea 2', value: 'l2' },
                    { name: '🚇 Línea 4', value: 'l4' },
                    { name: '🚇 Línea 5', value: 'l5' }
                )
        ),

    async execute(interaction, metro) {
        try {
            await interaction.deferReply();
            const lineValue = interaction.options.getString('linea');
            const message = await expresoButton.build(lineValue, metro);
            await interaction.editReply(message);
        } catch (error) {
            console.error('Expreso info command failed:', error);
            await interaction.editReply({
                content: '❌ Error al procesar la información de rutas expresas',
                ephemeral: true
            });
        }
    }
};