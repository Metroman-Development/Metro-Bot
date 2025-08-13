const { SlashCommandBuilder } = require('discord.js');
const commerceResultsManager = require('../../../../../events/interactions/buttons/commerceResultsManager');
const metroConfig = require('../../../../../config/metro/metroConfig');
const styles = {};

module.exports = {
    parentCommand: 'buscar',
    data: (subcommand) => subcommand
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

    async autocomplete(interaction, metro) {
        const focusedValue = this.normalizeString(interaction.options.getFocused());
        const staticData = metro._staticData;
        
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

    async execute(interaction, metro) {
        await interaction.deferReply();
        const commerceQuery = interaction.options.getString('nombre');
        const staticData = metro._staticData;
        const normalizedQuery = this.normalizeString(commerceQuery);

        const allResults = [];
        Object.values(staticData.stations).forEach(station => {
            if (!station.commerce || station.commerce === 'None') return;

            const commerceItems = station.commerce.split(',')
                .map(item => item.trim())
                .filter(item => item);

            const matchingItems = commerceItems.filter(item => 
                this.normalizeString(item).includes(normalizedQuery)
            );

            if (matchingItems.length > 0) {
                allResults.push({
                    id: station.id,
                    name: station.displayName,
                    line: station.line.toUpperCase(),
                    matching: matchingItems,
                });
            }
        });

        if (allResults.length === 0) {
            return interaction.editReply({
                content: `🔍 No se encontraron estaciones con comercio relacionado a "${commerceQuery}"`,
                ephemeral: true
            });
        }

        const context = {
            query: commerceQuery,
            results: allResults,
        };

        const messageData = await commerceResultsManager.build(interaction, context);
        await interaction.editReply(messageData);
    }
};