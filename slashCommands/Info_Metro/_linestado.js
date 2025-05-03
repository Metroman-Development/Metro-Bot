const { SlashCommandBuilder } = require('discord.js');
const StatusEmbed = require('../../templates/embeds/StatusEmbed');
const SearchCore = require('../../modules/metro/search/SearchCore');

module.exports = {
    
    parentCommand: 'linea',
    data: (subcommand) => subcommand
        .setName('estado')
        .setDescription('Muestra el estado operacional de lineas')
        .addStringOption(option =>
    option.setName('linea')
        .setDescription('Selecciona una línea del Metro de Santiago')
        .setRequired(true)
        .addChoices(
            { name: '🚇 Línea 1', value: 'l1' },
            { name: '🚇 Línea 2', value: 'l2' },
            { name: '🚇 Línea 3', value: 'l3' },
            { name: '🚇 Línea 4', value: 'l4' },
            { name: '🚇 Línea 4A', value: 'l4a' },
            { name: '🚇 Línea 5', value: 'l5' },
            { name: '🚇 Línea 6', value: 'l6' }
        )
),
                

  async execute(interaction, metro) {
    try {
        await interaction.deferReply();

        const elementValue = interaction.options.getString('linea');
        
        //console.log(metro.api) 
        
        const metroData = metro.api.getProcessedData();
        const networkStatus = metroData.network;
        const lastUpdated = new Date(networkStatus.lastUpdated).toLocaleString('es-CL');

        

        // Handle station status case
        

            const line = metroData.lines[elementValue]
            console.log(line);
                

            const response = StatusEmbed.createLineStatus(
                metro, 
                
                line
                )
            

            await interaction.editReply({ embeds: [response.embed] });
        
    } catch (error) {
        console.error('Estado command failed:', error);
        await interaction.editReply({
            content: '❌ Error al procesar la solicitud',
            ephemeral: true
        });
    }
}, 
    
    _getStatusText(statusCode) {
        const statusMap = {
            '1': 'Operativa',
            '2': 'Parcial',
            '3': 'Cerrada',
            'default': 'Desconocido'
        };
        return statusMap[statusCode] || statusMap.default;
    },

    _getStatusEmoji(statusCode) {
        const emojiMap = {
            '1': '🟢',
            '2': '🟡',
            '3': '🔴',
            'default': '⚪'
        };
        return emojiMap[statusCode] || emojiMap.default;
    }
};