// _buscaramenities.js
// _buscaramenities.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const AmenitiesResultsManager = require('../../../../../events/interactions/buttons/AmenitiesResultsManager');
const config = require('../../../../../config/metro/metroConfig');
const styles = require('../../../../../config/styles.json');

module.exports = {
    parentCommand: 'buscar',
    data: (subcommand) => subcommand
        .setName('cultura')
        .setDescription('Buscar estaciones con algun elemento cultural')
        .addStringOption(option =>
            option.setName('nombre')
                .setDescription('Nombre de la amenidad a buscar')
                .setRequired(true)
                .addChoices(
                    { name: 'Bibliometro', value: 'Bibliometro' },
                    { name: 'Metroinforma', value: 'Metroinforma' },
                    { name: 'Metroarte', value: 'Metroarte' }
                )),

    normalizeString(str) {
        return str
            .toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]/g, '');
    },

    async execute(interaction, metro) {
        await interaction.deferReply();
        const amenityQuery = interaction.options.getString('nombre');
        const staticData = metro._staticData;
        const normalizedQuery = this.normalizeString(amenityQuery);

        // Find matching stations with enhanced amenities processing
        const allResults = [];
        Object.values(staticData.stations).forEach(station => {
            if (!station.amenities || station.amenities === 'None') return;

            const amenityItems = station.amenities.split(',')
                .map(item => item.trim())
                .filter(item => item);

            const matchingItems = amenityItems.filter(item => 
                this.normalizeString(item).includes(normalizedQuery)
            );

            if (matchingItems.length > 0) {
                // Enhanced amenities display processing
                const processedAmenities = amenityItems.map(item => {
                    // Try to find exact matches in config
                    if (config.amenities && config.amenities[item]) {
                        return config.amenities[item];
                    }
                    
                    // Handle combined names
                    let combinedMatch = Object.keys(config.amenities || {}).find(name => 
                        item.toLowerCase().includes(name.toLowerCase())
                    );
                    
                    if (combinedMatch) {
                        let result = item;
                        Object.keys(config.amenities).forEach(name => {
                            if (item.toLowerCase().includes(name.toLowerCase())) {
                                result = result.replace(new RegExp(name, 'gi'), config.amenities[name]);
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
                    color: styles.lineColors[station.line.toLowerCase()] || '#FFA500',
                    stationData: station
                });
            }
        });

        if (allResults.length === 0) {
            return interaction.editReply({
                content: `🔍 No se encontraron estaciones con amenities relacionadas a "${amenityQuery}"`,
                ephemeral: true
            });
        }

        // Create and use the manager with enhanced options
        const manager = new AmenitiesResultsManager();
        const messageData = await manager.build(
            amenityQuery,
            allResults,
            interaction.user.id
        );

        await interaction.editReply(messageData);
    }
};
