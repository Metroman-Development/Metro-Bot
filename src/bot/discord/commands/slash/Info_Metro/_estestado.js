const { SlashCommandBuilder } = require('discord.js');
const StatusEmbeds = require('../../../../../utils/embeds/statusEmbeds');
const SearchCore = require('../../../../../core/metro/search/SearchCore');

/**
 * @file Subcommand for the 'estacion' command, providing the operational status of a station.
 * @description This subcommand allows users to check the current operational status of a specific metro station.
 */
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

    /**
     * Handles autocomplete for the 'estacion' option.
     * @param {import('discord.js').Interaction} interaction The interaction object.
     * @param {import('../../modules/metro/core/MetroCore')} metro The MetroCore instance.
     */
    async autocomplete(interaction, metro) {
        const focusedValue = interaction.options.getFocused().toLowerCase();
        
        try {
            const stationSearcher = new SearchCore('station');
            stationSearcher.setDataSource(metro.api.getProcessedData());

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

    /**
     * Executes the 'estado' subcommand.
     * @param {import('discord.js').Interaction} interaction The interaction object.
     * @param {import('../../modules/metro/core/MetroCore')} metro The MetroCore instance.
     */
    async execute(interaction, metro) {
        try {
            await interaction.deferReply();

            const stationId = interaction.options.getString('estacion');
            const metroData = metro.api.getProcessedData();
            
            const station = Object.values(metroData.stations).find(s => s.id === stationId);

            if (!station) {
                return await interaction.editReply({ 
                    content: '❌ No se pudo encontrar la estación especificada. Por favor, selecciónala de la lista.',
                    ephemeral: true 
                });
            }
            
            const statusEmbeds = new StatusEmbeds(metro);
            const embed = statusEmbeds.buildStationEmbed(station);
            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Error executing "estacion estado" command:', error);
            await interaction.editReply({
                content: '❌ Ocurrió un error al procesar tu solicitud. Por favor, inténtalo de nuevo.',
                ephemeral: true
            });
        }
    }
};