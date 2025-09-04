const { SlashCommandSubcommandBuilder } = require('discord.js');
const { createErrorEmbed } = require('../../../../../utils/embedFactory');
const DiscordMessageFormatter = require('../../../../../formatters/DiscordMessageFormatter');
const { MetroInfoProvider } = require('../../../../../utils/MetroInfoProvider');
const cacheManager = require('../../../../../utils/cacheManager');

module.exports = {
    data: new SlashCommandSubcommandBuilder()
        .setName('info')
        .setDescription('Muestra información general sobre una estación de metro.')
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

const { createStationInfoCollector } = require('../../../../../utils/collectorManager');

    async execute(interaction) {
        await interaction.deferReply();
        const metroInfoProvider = MetroInfoProvider.getInstance();
        const stationId = interaction.options.getString('estacion');
        const station = metroInfoProvider.getStation(stationId.toUpperCase());

        if (!station) {
            const errorEmbed = await createErrorEmbed('No se pudo encontrar la estación especificada. Por favor, selecciónala de la lista.');
            return await interaction.editReply({ embeds: [errorEmbed] });
        }

        station.id = station.code;

        const formatter = new DiscordMessageFormatter();
        const messagePayload = await formatter.formatStationInfo(station, metroInfoProvider, interaction.user.id);

        const message = await interaction.editReply(messagePayload);

        createStationInfoCollector(message, interaction);
    }
};