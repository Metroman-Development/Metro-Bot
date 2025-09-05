const { SlashCommandSubcommandBuilder, EmbedBuilder } = require('discord.js');
const { MetroInfoProvider } = require('../../../../../utils/MetroInfoProvider');

module.exports = {
    data: new SlashCommandSubcommandBuilder()
        .setName('info')
        .setDescription('Muestra información del Metro de Santiago'),

    async execute(interaction) {
        await interaction.deferReply();
        const metroInfoProvider = MetroInfoProvider.getInstance();
        const metroInfo = metroInfoProvider.getFullData();
        const metroGeneral = metroInfo.metroinfo;

        const embed = new EmbedBuilder()
            .setTitle(`🚇 ${metroGeneral.name}`)
            .setColor('#005BA6') // Metro's blue color
            .setDescription(`**Sistema:** ${metroGeneral.system}`)
            .addFields(
                {
                    name: '📅 Inauguración',
                    value: metroGeneral.inauguration,
                    inline: true
                },
                {
                    name: '📏 Longitud total',
                    value: metroGeneral.technicalCharacteristics.length,
                    inline: true
                },
                {
                    name: '🚉 Estaciones',
                    value: metroGeneral.technicalCharacteristics.stations.toString(),
                    inline: true
                },
                {
                    name: '🚈 Líneas en operación',
                    value: metroGeneral.operation.lines.toString(),
                    inline: true
                },
                {
                    name: '🚄 Trenes en flota',
                    value: metroGeneral.operation.fleet,
                    inline: true
                },
                {
                    name: '👥 Pasajeros diarios',
                    value: metroGeneral.operation.passengers.toLocaleString(),
                    inline: true
                },
                {
                    name: '⚡ Electrificación',
                    value: metroGeneral.technicalCharacteristics.electrification,
                    inline: false
                },
                {
                    name: '🏃 Velocidad máxima',
                    value: metroGeneral.technicalCharacteristics.maxSpeed,
                    inline: true
                },
                {
                    name: '🐢 Velocidad promedio',
                    value: metroGeneral.operation.averageSpeed,
                    inline: true
                }
            )
            .setFooter({
                text: `Metro de Santiago • Última actualización: ${new Date(metroInfo.last_updated).toLocaleString()}`
            })
            .setTimestamp();

        await interaction.editReply({
            embeds: [embed]
        });
    }
};