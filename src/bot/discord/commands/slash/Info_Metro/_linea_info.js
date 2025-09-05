const { SlashCommandSubcommandBuilder } = require('discord.js');
const { createErrorEmbed } = require('../../../../../utils/embedFactory');
const DiscordMessageFormatter = require('../../../../../formatters/DiscordMessageFormatter');
const { MetroInfoProvider } = require('../../../../../utils/MetroInfoProvider');

module.exports = {
    data: new SlashCommandSubcommandBuilder()
        .setName('info')
        .setDescription('Muestra información de lineas del Metro de Santiago')
        .addStringOption(option =>
            option.setName('linea')
                .setDescription('Selecciona una línea')
                .setRequired(true)
                .addChoices(
                    { name: '🚇 Línea 1', value: 'l1' },
                    { name: '🚇 Línea 2', value: 'l2' },
                    { name: '🚇 Línea 3', value: 'l3' },
                    { name: '🚇 Línea 4', value: 'l4' },
                    { name: '🚇 Línea 4A', value: 'l4a' },
                    { name: '🚇 Línea 5', value: 'l5' },
                    { name: '🚇 Línea 6', value: 'l6' },
                )
        ),

    async execute(interaction) {
        await interaction.deferReply();
        const metroInfoProvider = MetroInfoProvider.getInstance();
        const lineId = interaction.options.getString('linea');
        const lineInfo = metroInfoProvider.getLine(lineId);

        if (!lineInfo) {
            const errorEmbed = await createErrorEmbed('No se encontró información para esta línea');
            return await interaction.editReply({ embeds: [errorEmbed] });
        }

        const formatter = new DiscordMessageFormatter();
        const message = await formatter.formatLineInfo(lineInfo, interaction.user.id);

        await interaction.editReply(message);
    }
};