const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const BaseCommand = require('../BaseCommand');
const { MetroInfoProvider } = require('../../../../utils/MetroInfoProvider.js');

class IntermodalCommand extends BaseCommand {
    constructor() {
        super(new SlashCommandBuilder()
            .setName('intermodal')
            .setDescription('Información de conexiones intermodales')
            .addStringOption(option =>
                option.setName('estacion')
                    .setDescription('Nombre de la estación')
                    .setAutocomplete(true)
                    .setRequired(true)
            )
        );
        this.category = "Metro Info";
    }

    async autocomplete(interaction) {
        const metroInfoProvider = MetroInfoProvider.getInstance();
        const focusedValue = interaction.options.getFocused();
        const stations = Object.values(metroInfoProvider.getStations())
            .filter(s => s.connections && s.connections.length > 0)
            .map(s => ({
                name: s.station_name,
                value: s.station_id
            }));

        const filtered = stations.filter(station =>
            station.name.toLowerCase().includes(focusedValue.toLowerCase())
        ).slice(0, 25);

        await interaction.respond(filtered);
    }

    async run(interaction) {
        const stationId = interaction.options.getString('estacion');
        const metroInfoProvider = MetroInfoProvider.getInstance();
        const station = metroInfoProvider.getStationById(stationId);

        if (!station) {
            return interaction.reply({ content: '❌ Estación no encontrada', ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setTitle(`🔀 ${station.station_name} - Conexiones`)
            .setDescription(`**Línea:** ${station.line_id.toUpperCase()}`)
            .addFields(
                {
                    name: 'Transporte Público',
                    value: station.connections.transports?.join('\n') || 'No disponible',
                    inline: true
                },
                {
                    name: 'Bicicletas',
                    value: station.connections.bikes?.join('\n') || 'No disponible',
                    inline: true
                }
            );

        await interaction.reply({ embeds: [embed] });
    }
}

module.exports = new IntermodalCommand();