const { SlashCommandBuilder } = require('discord.js');
const SearchCore = require('../../modules/metro/search/SearchCore');
const StationInfoButton = require('../../modules/interactions/buttons/StationInfoButton');

/**
 * @file Subcommand for the 'estacion' command, providing general information about a station.
 * @description This subcommand displays a comprehensive overview of a specific metro station, including its services, amenities, and connections.
 */
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
            console.error('Error handling autocomplete for "estacion info":', error);
            await interaction.respond([]);
        }
    },

    /**
     * Executes the 'info' subcommand.
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

            // Create and send the station information message.
            const stationButton = new StationInfoButton();
            const message = await stationButton.build(station, metro);
            
            await interaction.editReply(message);

        } catch (error) {
            console.error('Error executing "estacion info" command:', error);
            // Ensure a reply is sent even if an error occurs.
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({
                    content: '❌ Ocurrió un error al procesar tu solicitud. Por favor, inténtalo de nuevo.',
                    ephemeral: true
                });
            } else {
                await interaction.reply({
                    content: '❌ Ocurrió un error al procesar tu solicitud. Por favor, inténtalo de nuevo.',
                    ephemeral: true
                });
            }
        }
    }
};