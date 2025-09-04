const { SlashCommandBuilder } = require('discord.js');
const { handleCommandError } = require('../../../../../utils/commandUtils');
const { createErrorEmbed } = require('../../../../../utils/embedFactory');
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

    async autocomplete(interaction, metroInfoProvider) {
        const focusedValue = interaction.options.getFocused().toLowerCase();
        try {
            const stations = Object.values(metroInfoProvider.getStations());
            const filteredStations = stations.filter(station => {
                const stationName = station.name || '';
                const stationCode = station.code || '';
                return stationName.toLowerCase().includes(focusedValue) ||
                       stationCode.toLowerCase().includes(focusedValue);
            }).slice(0, 25);

            await interaction.respond(
                filteredStations.map(station => ({
                    name: `Estación ${station.name} (L${station.line_id.toUpperCase()})`,
                    value: station.name
                }))
            );
        } catch (error) {
            console.error('Error handling autocomplete for "estacion info":', error);
            await interaction.respond([]);
        }
    },

    async execute(interaction, metroInfoProvider) {
        try {
            const stationId = interaction.options.getString('estacion');
            const station = metroInfoProvider.getStationById(stationId);

            if (!station) {
                const errorEmbed = await createErrorEmbed('No se pudo encontrar la estación especificada. Por favor, selecciónala de la lista.');
                return await interaction.editReply({ embeds: [errorEmbed], ephemeral: true });
            }

            const formatter = new DiscordMessageFormatter();
            const message = await formatter.formatStationInfo(station, metroInfoProvider, interaction.user.id);
            
            await interaction.editReply(message);

        } catch (error) {
            await handleCommandError(error, interaction);
        }
    }
};