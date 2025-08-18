const { SlashCommandBuilder } = require('discord.js');
const MetroInfoProvider = require('../../../../../core/metro/providers/MetroInfoProvider');
const DiscordMessageFormatter = require('../../../../../formatters/DiscordMessageFormatter');
const SearchCore = require('../../../../../core/metro/search/SearchCore');

module.exports = {
    parentCommand: 'estacion',
    data: (subcommand) => subcommand
        .setName('estado')
        .setDescription('Muestra el estado operacional de una estación de metro.')
        .addStringOption(option =>
            option.setName('estacion')
                .setDescription('El nombre de la estación que deseas consultar.')
                .setAutocomplete(true)
                .setRequired(true)),

    async autocomplete(interaction, metro) {
        const focusedValue = interaction.options.getFocused().toLowerCase();
        
        try {
            const stationSearcher = new SearchCore('station');
            stationSearcher.setDataSource(await metro.getCurrentData());

            const stationResults = await stationSearcher.search(focusedValue, { maxResults: 25 });

            await interaction.respond(
                stationResults.map(result => ({
                    name: `Estación ${result.displayName} (L${result.line.toUpperCase()})`,
                    value: result.id
                }))
            );
        } catch (error) {
            console.error('Error handling autocomplete for "estacion estado":', error);
            await interaction.respond([]);
        }
    },

    async execute(interaction, metro) {
        try {
            await interaction.deferReply();

            const stationId = interaction.options.getString('estacion');
            const infoProvider = new MetroInfoProvider(metro);
            const station = infoProvider.getStationById(stationId);

            if (!station) {
                return await interaction.editReply({ 
                    content: '❌ No se pudo encontrar la estación especificada. Por favor, selecciónala de la lista.',
                    ephemeral: true 
                });
            }
            
            const formatter = new DiscordMessageFormatter();
            const message = formatter.formatStationStatus(station);
            await interaction.editReply(message);

        } catch (error) {
            console.error('Error executing "estacion estado" command:', error);
            await interaction.editReply({
                content: '❌ Ocurrió un error al procesar tu solicitud. Por favor, inténtalo de nuevo.',
                ephemeral: true
            });
        }
    }
};