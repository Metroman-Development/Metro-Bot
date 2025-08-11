const { SlashCommandBuilder } = require('discord.js');
const StatusEmbeds = require('../../utils/embeds/statusEmbeds');
const SearchCore = require('../../modules/metro/search/SearchCore');

module.exports = {
    
    parentCommand: 'estacion',
    data: (subcommand) => subcommand
        .setName('estado')
        .setDescription('Muestra el estado operacional de estaciones')
        .addStringOption(option =>
            option.setName('elemento')
                .setDescription('Estación Específica')
                             
                .setAutocomplete(true)),

    async autocomplete(interaction, metro) {
        const focusedValue = interaction.options.getFocused().toLowerCase();
        
        try {
            // Initialize search cores
            
            const stationSearcher = new SearchCore('station');
           // lineSearcher.setDataSource(metro.getCurrentData());
            stationSearcher.setDataSource(metro.api.getProcessedData());

            // Search both lines and stations
            const stationResults = await Promise.all([
               // lineSearcher.search(focusedValue, { maxResults: 5 }),
                stationSearcher.search(focusedValue, { maxResults: 5 })
            ]);

            const allResults = [ ...stationResults]
                .sort((a, b) => b.score - a.score)
                .slice(0, 25);

            await interaction.respond(
                allResults.map(result => ({
                 //   name: result.type === 'line' 
                //        ? `Línea ${result.id.toUpperCase()} (${result.displayName})`
                       name: `Estación ${result.displayName} (L${result.line.toUpperCase()})`,
                    value: `${result.type}:${result.id}`
                }))
            );
        } catch (error) {
            console.error('Autocomplete error:', error);
            await interaction.respond([]);
        }
    },

  async execute(interaction, metro) {
    try {
        await interaction.deferReply();
        const statusEmbeds = new StatusEmbeds(metro);
        const elementValue = interaction.options.getString('elemento');
        const metroData = metro.api.getProcessedData();

        if (!elementValue) {
            // Handle network status case
            const networkStatus = metroData.network;
            const embed = statusEmbeds.buildOverviewEmbed(networkStatus);
            return await interaction.editReply({ embeds: [embed] });
        }

        // Handle station status case
        const [elementType, elementId] = elementValue.includes(':') ? 
            elementValue.split(':') : 
            ['station', elementValue];

        if (elementType === 'station') {
            const searcher = new SearchCore('station');
            searcher.setDataSource(metroData);
            
            const results = await searcher.search(elementId, {
                maxResults: 1,
                needsOneMatch: true
            });

            if (!results?.length) {
                return await interaction.editReply({ 
                    content: '❌ No se encontró la estación especificada', 
                    ephemeral: true 
                });
            }

            const station = Object.values(metroData.stations).find(
                s => s.id === results[0].id
            );

            if (!station) { 
                return await interaction.editReply({ 
                    content: '❌ Datos de estación no disponibles', 
                    ephemeral: true 
                });
            }
            
            const embed = statusEmbeds.buildStationEmbed(station);
            await interaction.editReply({ embeds: [embed] });
        }
    } catch (error) {
        console.error('Estado command failed:', error);
        await interaction.editReply({
            content: '❌ Error al procesar la solicitud',
            ephemeral: true
        });
    }
}
};