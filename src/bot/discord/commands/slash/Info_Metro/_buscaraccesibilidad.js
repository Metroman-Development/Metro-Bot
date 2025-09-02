// _buscaraccesibilidad.js - Updated to support both old and new formats
const { SlashCommandBuilder } = require('discord.js');
const AccessibilityResultsManager = require('../../../../../events/interactions/buttons/AccessibilityResultsManager');
const styles = require('../../../../../config/styles.json');

module.exports = {
    parentCommand: 'buscar',
    data: (subcommand) => subcommand
        .setName('accesibilidad')
        .setDescription('Buscar estaciones por estado de accesibilidad')
        .addStringOption(option =>
            option.setName('estado')
                .setDescription('Estado de accesibilidad a buscar')
                .setRequired(true)
                .addChoices(
                    { name: 'Operativa', value: 'Operativa' },
                    { name: 'Fuera de Servicio', value: 'FueraServicio' }
                ))
        .addStringOption(option =>
            option.setName('equipo')
                .setDescription('Filtrar por tipo de equipo')
                .setRequired(false)
                .addChoices(
                    { name: 'Ascensor', value: 'ascensor' },
                    { name: 'Escalera Mecánica', value: 'escalera' },
                    { name: 'Ambos', value: 'ambos' }
                )),

    async execute(interaction, metroInfoProvider) {
        await interaction.deferReply();
        const statusQuery = interaction.options.getString('estado');
        const equipmentFilter = interaction.options.getString('equipo');

        // Get accessibility data from the database
        const accessibilityData = metroInfoProvider.getFullData().accessibility;

        if (!accessibilityData || accessibilityData.length === 0) {
            return this.sendNoResultsResponse(interaction, statusQuery, equipmentFilter);
        }

        // Process the data
        const stationData = {};
        const staticStations = metroInfoProvider.getStations();

        for (const item of accessibilityData) {
            const stationId = `${item.station_code}-${item.line_id}`;
            if (!stationData[stationId]) {
                const staticStation = staticStations[stationId];
                if (!staticStation) continue; // Skip if no static data for the station

                stationData[stationId] = {
                    id: stationId,
                    name: staticStation.displayName,
                    line: item.line_id.toUpperCase(),
                    color: styles.lineColors[item.line_id.toLowerCase()] || '#FFA500',
                    stationData: {
                        ...staticStation,
                        accessDetails: {
                            elevators: [],
                            escalators: []
                        }
                    },
                    isNewFormat: true,
                    hasElevator: false,
                    hasEscalator: false,
                    elevatorWorking: true,
                    escalatorWorking: true,
                };
            }

            const station = stationData[stationId];
            if (item.type === 'ascensor') {
                station.hasElevator = true;
                station.stationData.accessDetails.elevators.push(item);
                if (item.status !== 1) {
                    station.elevatorWorking = false;
                }
            } else if (item.type === 'escalera') {
                station.hasEscalator = true;
                station.stationData.accessDetails.escalators.push(item);
                if (item.status !== 1) {
                    station.escalatorWorking = false;
                }
            }
        }

        const allResults = Object.values(stationData).filter(station => {
            let matchesEquipment = true;
            if (equipmentFilter) {
                if (equipmentFilter === 'ascensor') {
                    matchesEquipment = station.hasElevator;
                } else if (equipmentFilter === 'escalera') {
                    matchesEquipment = station.hasEscalator;
                } else if (equipmentFilter === 'ambos') {
                    matchesEquipment = station.hasElevator && station.hasEscalator;
                }
            }

            let matchesStatus = false;
            if (statusQuery === 'Operativa') {
                if (equipmentFilter === 'ascensor') {
                    matchesStatus = station.elevatorWorking;
                } else if (equipmentFilter === 'escalera') {
                    matchesStatus = station.escalatorWorking;
                } else if (equipmentFilter === 'ambos') {
                    matchesStatus = station.elevatorWorking && station.escalatorWorking;
                } else {
                    matchesStatus = (!station.hasElevator || station.elevatorWorking) && (!station.hasEscalator || station.escalatorWorking);
                }
            } else { // 'FueraServicio'
                if (equipmentFilter === 'ascensor') {
                    matchesStatus = !station.elevatorWorking;
                } else if (equipmentFilter === 'escalera') {
                    matchesStatus = !station.escalatorWorking;
                } else if (equipmentFilter === 'ambos') {
                    matchesStatus = !station.elevatorWorking && !station.escalatorWorking;
                } else {
                    matchesStatus = (station.hasElevator && !station.elevatorWorking) || (station.hasEscalator && !station.escalatorWorking);
                }
            }

            return matchesEquipment && matchesStatus;
        });


        if (allResults.length === 0) {
            return this.sendNoResultsResponse(interaction, statusQuery, equipmentFilter);
        }

        // Create and use the manager
        const manager = new AccessibilityResultsManager();
        const filters = {
            ascensor: equipmentFilter === 'ascensor' || equipmentFilter === 'ambos',
            escaleraMecanica: equipmentFilter === 'escalera' || equipmentFilter === 'ambos',
            operativo: statusQuery === 'Operativa',
            fueraDeServicio: statusQuery !== 'Operativa'
        };

        const messageData = manager.buildAccessibilityReply(
            statusQuery,
            filters,
            allResults,
            interaction.user.id
        );

        await interaction.editReply(messageData);
    },

    /**
     * Sends a response when no stations are found
     */
    sendNoResultsResponse(interaction, statusQuery, equipmentFilter) {
        let message = `🔍 No se encontraron estaciones `;
        const statusText = statusQuery === 'Operativa' ? 'operativas' : 'con problemas de accesibilidad';
        
        message += statusText;
        
        if (equipmentFilter) {
            message += ' en ';
            if (equipmentFilter === 'ascensor') message += 'ascensores';
            else if (equipmentFilter === 'escalera') message += 'escaleras mecánicas';
            else message += 'ambos equipos';
        }
        
        return interaction.editReply({
            content: message,
            ephemeral: true
        });
    }
};
