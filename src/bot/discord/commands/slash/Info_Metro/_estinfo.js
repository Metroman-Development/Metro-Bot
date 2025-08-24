const { SlashCommandBuilder } = require('discord.js');
const { searchStations } = require('../../../../../utils/metroUtils');
const { handleCommandError } = require('../../../../../utils/commandUtils');
const { createErrorEmbed } = require('../../../../../utils/embedFactory');
const MetroInfoProvider = require('../../../../../core/metro/providers/MetroInfoProvider');
const DiscordMessageFormatter = require('../../../../../formatters/DiscordMessageFormatter');

module.exports = {
    parentCommand: 'estacion',
    data: (subcommand) => subcommand
        .setName('info')
        .setDescription('Muestra información general sobre una estación de metro.')
        .addStringOption(option =>
            option.setName('estacion')
                .setDescription('El nombre de la estación que deseas consultar.')
                .setAutocomplete(true)
                .setRequired(true)),

    async autocomplete(interaction, metro) {
        const focusedValue = interaction.options.getFocused();
        try {
            const stationResults = await searchStations(metro, focusedValue);
            await interaction.respond(
                stationResults.map(result => ({
                    name: `Estación ${result.displayName} (L${result.line.toUpperCase()})`,
                    value: result.id
                }))
            );
        } catch (error) {
            console.error('Error handling autocomplete for "estacion info":', error);
            await interaction.respond([]);
        }
    },

    async execute(interaction, metro) {
        try {
            const stationId = interaction.options.getString('estacion');
            const infoProvider = new MetroInfoProvider(metro);
            const station = infoProvider.getStationById(stationId);

            if (!station) {
                const errorEmbed = await createErrorEmbed('No se pudo encontrar la estación especificada. Por favor, selecciónala de la lista.');
                return await interaction.editReply({ embeds: [errorEmbed], ephemeral: true });
            }

            const formatter = new DiscordMessageFormatter();
            const message = await formatter.formatStationInfo(station, metro, interaction.user.id);
            
            await interaction.editReply(message);

        } catch (error) {
            await handleCommandError(error, interaction);
        }
    }
};