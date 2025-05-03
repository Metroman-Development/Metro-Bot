const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    parentCommand: 'metro',
    data: (subcommand) => subcommand
        .setName('info')
        .setDescription('Muestra información del Metro de Santiago'),

    async execute(interaction, metro) {
        try {
            await interaction.deferReply();
            
            const metroInfo = metro._staticData.system;
            
            
            console.log(metroInfo)
            // Build the embed with system information
            const embed = new EmbedBuilder()
                .setTitle(`🚇 ${metroInfo.name}`)
                .setColor('#005BA6') // Metro's blue color
                .setDescription(`**Sistema:** ${metroInfo.system}`)
                .addFields(
                    {
                        name: '📅 Inauguración',
                        value: metroInfo.inauguration,
                        inline: true
                    },
                    {
                        name: '📏 Longitud total',
                        value: metroInfo.technicalCharacteristics.length,
                        inline: true
                    },
                    {
                        name: '🚉 Estaciones',
                        value: metroInfo.technicalCharacteristics.stations.toString(),
                        inline: true
                    },
                    {
                        name: '🚈 Líneas en operación',
                        value: metroInfo.operation.lines.toString(),
                        inline: true
                    },
                    {
                        name: '🚄 Trenes en flota',
                        value: metroInfo.operation.fleet,
                        inline: true
                    },
                    {
                        name: '👥 Pasajeros diarios',
                        value: metroInfo.operation.passengers.toLocaleString(),
                        inline: true
                    },
                    {
                        name: '⚡ Electrificación',
                        value: metroInfo.technicalCharacteristics.electrification,
                        inline: false
                    },
                    {
                        name: '🏃 Velocidad máxima',
                        value: metroInfo.technicalCharacteristics.maxSpeed,
                        inline: true
                    },
                    {
                        name: '🐢 Velocidad promedio',
                        value: metroInfo.operation.averageSpeed,
                        inline: true
                    }
                )
                .setFooter({ 
                    text: 'Metro de Santiago • Última actualización', 
                   // iconURL: 'https://i.imgur.com/7kM4Yfn.png' 
                })
                .setTimestamp();

            await interaction.editReply({
                embeds: [embed]
            });

        } catch (error) {
            console.error('Error en comando metro info:', error);
            await interaction.editReply({
                content: '❌ Ocurrió un error al obtener la información',
                ephemeral: true
            });
        }
    }
};