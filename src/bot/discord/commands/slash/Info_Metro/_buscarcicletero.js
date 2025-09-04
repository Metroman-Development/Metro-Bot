const { SlashCommandSubcommandBuilder } = require('discord.js');
const BikeResultsManager = require('../../../../../events/interactions/buttons/BikeResultsManager');
const styles = require('../../../../../config/styles.json');
const SearchCore = require('../../../../../core/metro/search/SearchCore');
const { MetroInfoProvider } = require('../../../../../utils/MetroInfoProvider');

module.exports = {
    data: new SlashCommandSubcommandBuilder()
        .setName('cicletero')
        .setDescription('Buscar estaciones por disponibilidad de bicicletas')
        .addStringOption(option =>
            option.setName('tipo')
                .setDescription('Tipo de servicio de bicicletas')
                .setRequired(true)
                .addChoices(
                    { name: 'Línea Cero', value: 'Línea Cero' },
                    { name: 'Bicimetro', value: 'Bicimetro' },
                    { name: 'U Invertida', value: 'U Invertida' }
                )),

    normalizeString(str) {
        return str
            .toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]/g, '');
    },

    async run(interaction) {
        await interaction.deferReply();
        const metroInfoProvider = MetroInfoProvider.getInstance();
        const bikeQuery = interaction.options.getString('tipo');

        const searchCore = new SearchCore('station');
        searchCore.setDataSource(metroInfoProvider.getFullData());

        const results = await searchCore.search(bikeQuery, { bikeFilter: bikeQuery });

        if (!results || results.length === 0) {
            return interaction.editReply({
                content: `🚴 No se encontraron estaciones con servicios de bicicletas relacionados a "${bikeQuery}"`,
                ephemeral: true
            });
        }

        const allResults = results.map(station => ({
            id: station.id,
            name: station.displayName,
            line: station.line.toUpperCase(),
            matching: [bikeQuery],
            allBikes: station.connections.bikes,
            color: styles.lineColors[station.line.toLowerCase()] || '#FFA500',
            stationData: station
        }));

        const manager = new BikeResultsManager();
        const messageData = await manager.build(
            bikeQuery,
            allResults,
            interaction.user.id
        );

        await interaction.editReply(messageData);
    }
};