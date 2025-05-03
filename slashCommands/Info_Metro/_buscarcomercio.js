// _buscarcomercio.js
// _buscarcomercio.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const CommerceResultsManager = require('../../modules/interactions/buttons/CommerceResultsManager');
const config = require('../../config/metro/metroConfig');
const styles = require('../../config/metro/styles.json');

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
        
        // Extract all unique commerce types
        const commerceTypes = new Set();
        Object.values(staticData.stations).forEach(station => {
            if (station.commerce && station.commerce !== 'None') {
                station.commerce.split(',')
                    .map(item => item.trim())
                    .filter(item => item)
                    .forEach(item => commerceTypes.add(item));
            }
        });

        // Find matches with basic typo tolerance
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

        // Find matching stations with enhanced commerce processing
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
                // Enhanced commerce display processing
                const processedCommerce = commerceItems.map(item => {
                    // Try to find exact matches in config
                    if (config.commerce && config.commerce[item]) {
                        return config.commerce[item];
                    }
                    
                    // Handle combined names
                    let combinedMatch = Object.keys(config.commerce || {}).find(name => 
                        item.toLowerCase().includes(name.toLowerCase())
                    );
                    
                    if (combinedMatch) {
                        let result = item;
                        Object.keys(config.commerce).forEach(name => {
                            if (item.toLowerCase().includes(name.toLowerCase())) {
                                result = result.replace(new RegExp(name, 'gi'), config.commerce[name]);
                            }
                        });
                        return result;
                    }
                    
                    return item; // Return original if no special formatting
                }).join(', ');

                allResults.push({
                    id: station.id,
                    name: station.displayName,
                    line: station.line.toUpperCase(),
                    matching: matchingItems,
                    /*fullCommerce: processedCommerce, // Use processed commerce string*/
                    color: styles.lineColors[station.line.toLowerCase()] || '#FFA500',
                    stationData: station // Include full station data for potential future use
                });
            }
        });

        if (allResults.length === 0) {
            return interaction.editReply({
                content: `🔍 No se encontraron estaciones con comercio relacionado a "${commerceQuery}"`,
                ephemeral: true
            });
        }

        // Create and use the manager with enhanced options
        const manager = new CommerceResultsManager();
        const messageData = await manager.build(
            commerceQuery,
            allResults,
            interaction.user.id
        );

        await interaction.editReply(messageData);
    }
};