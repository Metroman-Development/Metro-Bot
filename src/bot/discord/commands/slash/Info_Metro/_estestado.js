const { SlashCommandSubcommandBuilder } = require('discord.js');
const DiscordMessageFormatter = require('../../../../../formatters/DiscordMessageFormatter');
const { MetroInfoProvider } = require('../../../../../utils/MetroInfoProvider');

module.exports = {
    data: new SlashCommandSubcommandBuilder()
        .setName('estado')
        .setDescription('Muestra el estado operacional de una estación de metro.')
        .addStringOption(option =>
            option.setName('estacion')
                .setDescription('El nombre de la estación que deseas consultar.')
                .setAutocomplete(true)
                .setRequired(true)),

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused().toLowerCase();
        const metroInfoProvider = MetroInfoProvider.getInstance();
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
                value: station.code
            }))
        );
    },

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const metroInfoProvider = MetroInfoProvider.getInstance();
        const stationId = interaction.options.getString('estacion');
        const station = metroInfoProvider.getStation(stationId);

        if (!station) {
            return await interaction.editReply({
                content: '❌ No se pudo encontrar la estación especificada. Por favor, selecciónala de la lista.',
                ephemeral: true
            });
        }

        const formatter = new DiscordMessageFormatter();
        const message = formatter.formatStationStatus(station);
        await interaction.editReply(message);
    }
};