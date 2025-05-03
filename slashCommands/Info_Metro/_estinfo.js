const { SlashCommandBuilder } = require('discord.js');
const SearchCore = require('../../modules/metro/search/SearchCore');
const StationInfoButton = require('../../modules/interactions/buttons/StationInfoButton');

module.exports = {
    parentCommand: 'estacion',
    data: (subcommand) => subcommand
        .setName('info')
        .setDescription('Muestra información general de estaciones')
        .addStringOption(option =>
            option.setName('elemento')
                .setDescription('Estación Específica')
                .setAutocomplete(true)
                .setRequired(true)),

    async autocomplete(interaction, metro) {
        const focusedValue = interaction.options.getFocused().toLowerCase();
        
        try {
            const stationSearcher = new SearchCore('station');
            stationSearcher.setDataSource(metro.api.getProcessedData());
            const stationResults = await stationSearcher.search(focusedValue, { maxResults: 5 });

            await interaction.respond(
                stationResults.map(result => ({
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
            const elementValue = interaction.options.getString('elemento');
            const metroData = metro.api.getProcessedData();

            // Parse station ID
            const [elementType, elementId] = elementValue.includes(':') ? 
                elementValue.split(':') : 
                ['station', elementValue];

            if (elementType !== 'station') {
                return await interaction.editReply({ 
                    content: '❌ Solo se puede buscar estaciones', 
                    ephemeral: true 
                });
            }

            // Find station
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

            const station = Object.values(metroData.stations).find(s => s.id === results[0].id);
            if (!station) {
                return await interaction.editReply({ 
                    content: '❌ Datos de estación no disponibles', 
                    ephemeral: true 
                });
            }

            // Create and send station info
            const stationButton = new StationInfoButton();
            const message = await stationButton.build(station, metro);
            
            if(!interaction.replied){
            
            const reply = await interaction.followUp(message);
                
                } else {
                    
                   const reply = await interaction.editReply(message);

               }
            

                

            // Set up interaction collector
      /*      const collector = reply.createMessageComponentCollector({
                filter: i => i.customId.startsWith('stationInfo:'),
                time: 15 * 60 * 1000 // 15 minutes
            });

            collector.on('collect', async i => {
                try {
                    await stationButton.handleInteraction(i);
                } catch (error) {
                    console.error('Error handling interaction:', error);
                    await i.reply({
                        content: 'Error al procesar la interacción',
                        ephemeral: true
                    });
                }
            });*/
          

      /*      collector.on('end', () => {
                reply.edit({ components: [] }).catch(console.error);
            });*/

        } catch (error) {
            console.error('Error en comando estacion info:', error);
            await interaction.editReply({
                content: '❌ Error al procesar la solicitud',
                ephemeral: true
            });
        }
    }
};