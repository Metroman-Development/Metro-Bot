const { SlashCommandSubcommandBuilder } = require('discord.js');
const commerceResultsManager = require('../../../../../events/interactions/buttons/commerceResultsManager');
const SearchCore = require('../../../../../core/metro/search/SearchCore');
const { MetroInfoProvider } = require('../../../../../utils/MetroInfoProvider');

module.exports = {
    data: new SlashCommandSubcommandBuilder()
        .setName('comercio')
        .setDescription('Buscar estaciones por tipo de comercio')
        .addStringOption(option =>
            option.setName('nombre')
                .setDescription('Nombre del comercio a buscar')
                .setRequired(true)
                .setAutocomplete(true)),

    normalizeString(str) {
        return str
            .toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]/g, '');
    },

    async autocomplete(interaction) {
        const metroInfoProvider = MetroInfoProvider.getInstance();
        const focusedValue = this.normalizeString(interaction.options.getFocused());
        const staticData = metroInfoProvider.getFullData();

        const commerceTypes = new Set();
        Object.values(staticData.stations).forEach(station => {
            if (station.commerce && station.commerce !== 'None') {
                station.commerce.split(',')
                    .map(item => item.trim())
                    .filter(item => item)
                    .forEach(item => commerceTypes.add(item));
            }
        });

        const matches = Array.from(commerceTypes)
            .filter(type => this.normalizeString(type).includes(focusedValue))
            .sort((a, b) => a.localeCompare(b))
            .slice(0, 25);

        await interaction.respond(
            matches.map(name => ({
                name: name.length > 45 ? `${name.substring(0, 42)}...` : name,
                value: name
            }))
        );
    },

    async run(interaction) {
        await interaction.deferReply();
        const metroInfoProvider = MetroInfoProvider.getInstance();
        const commerceQuery = interaction.options.getString('nombre');

        const searchCore = new SearchCore('station');
        searchCore.setDataSource(metroInfoProvider.getFullData());

        const results = await searchCore.search(commerceQuery, { commerceFilter: commerceQuery });

        if (!results || results.length === 0) {
            return interaction.editReply({
                content: `🔍 No se encontraron estaciones con comercio relacionado a "${commerceQuery}"`,
                ephemeral: true
            });
        }

        const allResults = results.map(station => ({
            id: station.id,
            name: station.displayName,
            line: station.line.toUpperCase(),
            matching: [commerceQuery],
        }));

        const context = {
            query: commerceQuery,
            results: allResults,
        };

        const messageData = await commerceResultsManager.build(interaction, context);
        await interaction.editReply(messageData);
    }
};