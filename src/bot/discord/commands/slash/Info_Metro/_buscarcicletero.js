// _buscarbike.js
const { SlashCommandBuilder } = require('discord.js');
const BikeResultsManager = require('../../../../../events/interactions/buttons/BikeResultsManager');
const styles = require('../../../../../config/styles.json');

module.exports = {
    parentCommand: 'buscar',
    data: (subcommand) => subcommand
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

    async execute(interaction, metroInfoProvider) {
        await interaction.deferReply();
        const bikeQuery = interaction.options.getString('tipo');
        const staticData = metroInfoProvider.getFullData();
        const normalizedQuery = this.normalizeString(bikeQuery);

        // Find matching stations
        const allResults = [];
        Object.values(staticData.stations).forEach(station => {
            const connections = station.connections
            
            if (!connections.bikes || !Array.isArray(connections.bikes)) return;
            
            const matchingServices = connections.bikes.filter(service => 
                service && this.normalizeString(service).includes(normalizedQuery)
            );

            if (matchingServices.length > 0) {
                allResults.push({
                    id: station.id,
                    name: station.displayName,
                    line: station.line.toUpperCase(),
                    matching: matchingServices,
                    allBikes: connections.bikes,
                    color: styles.lineColors[station.line.toLowerCase()] || '#FFA500',
                    stationData: station
                });
            }
        });

        if (allResults.length === 0) {
            return interaction.editReply({
                content: `🚴 No se encontraron estaciones con servicios de bicicletas relacionados a "${bikeQuery}"`,
                ephemeral: true
            });
        }

        // Create and use the manager
        const manager = new BikeResultsManager();
        const messageData = await manager.build(
            bikeQuery,
            allResults,
            interaction.user.id
        );

        await interaction.editReply(messageData);
    }
};