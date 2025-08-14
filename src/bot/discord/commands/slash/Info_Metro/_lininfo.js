const { SlashCommandBuilder } = require('discord.js');
const { handleCommandError } = require('../../../../../utils/commandUtils');
const { createEmbed, createErrorEmbed } = require('../../../../../utils/embedFactory');
const { processImageForDiscord } = require('../../../../../utils/imageUtils');

module.exports = {
    parentCommand: 'linea',
    data: (subcommand) => subcommand
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

    async execute(interaction, metro) {
        try {
            await interaction.deferReply();

            const lineKey = interaction.options.getString('linea');
            const lineInfo = metro?._staticData.lines[lineKey];

            if (!lineInfo) {
                const errorEmbed = await createErrorEmbed('No se encontró información para esta línea');
                return await interaction.editReply({ embeds: [errorEmbed], ephemeral: true });
            }

            let lineNumber = lineKey.replace('l', '').toUpperCase();
            if (lineKey === 'l4a') lineNumber = '4A';
            const githubImageUrl = `https://raw.githubusercontent.com/MetroManSR/MetroWeb/main/metrobot/assets/L%C3%ADnea_${lineNumber}_del_Metro_de_Santiago.svg.png`;

            const lineImage = await processImageForDiscord(githubImageUrl, {
                filename: `${lineKey}_map.png`,
                description: `Mapa de ${lineInfo.displayName}`,
                backgroundColor: '#FFFFFF',
                resize: {
                    width: 800,
                    height: 300,
                    fit: 'contain'
                }
            });

            if (!lineImage) {
                const errorEmbed = await createErrorEmbed('Error al cargar el mapa de la línea');
                return await interaction.editReply({ embeds: [errorEmbed], ephemeral: true });
            }

            const embed = await createEmbed('lineaInfo', { lineInfo, lineKey });

            await interaction.editReply({
                embeds: [embed],
                files: [lineImage]
            });

        } catch (error) {
            await handleCommandError(error, interaction);
        }
    }
};