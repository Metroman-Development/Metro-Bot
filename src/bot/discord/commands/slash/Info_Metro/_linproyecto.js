const { SlashCommandSubcommandBuilder } = require('discord.js');
const { createProjectInfoEmbed } = require('../../../../../utils/embeds');
const { MetroInfoProvider } = require('../../../../../utils/MetroInfoProvider');

module.exports = {
    data: new SlashCommandSubcommandBuilder()
        .setName('proyecto')
        .setDescription('Muestra información sobre un proyecto de línea.')
        .addStringOption(option =>
            option.setName('linea')
                .setDescription('El ID de la línea del proyecto (ej. L7, L8, L9)')
                .setRequired(true)
                .addChoices(
                    { name: '🚇 Línea 7', value: 'l7' },
                    { name: '🚇 Línea 8', value: 'l8' },
                    { name: '🚇 Línea 9', value: 'l9' }
                )
        ),
    async execute(interaction) {
        await interaction.deferReply();
        const metroInfoProvider = MetroInfoProvider.getInstance();
        const lineId = interaction.options.getString('linea');
        const projectInfo = metroInfoProvider.getFutureLine(lineId);

        if (!projectInfo) {
            return await interaction.editReply({
                content: '❌ No se encontró información para el proyecto de línea especificado.',
                ephemeral: true,
            });
        }

        const embed = createProjectInfoEmbed(projectInfo);
        await interaction.editReply({ embeds: [embed] });
    },
};
