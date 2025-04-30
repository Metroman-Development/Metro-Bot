// _buscaraccesibilidad.js - Line-by-Line Parsing Version
const { SlashCommandBuilder } = require('discord.js');
const AccessibilityResultsManager = require('../../modules/interactions/buttons/AccessibilityResultsManager');
const styles = require('../../config/metro/styles.json');

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

    async execute(interaction, metro) {
        await interaction.deferReply();
        const statusQuery = interaction.options.getString('estado');
        const equipmentFilter = interaction.options.getString('equipo');
        const staticData = metro._staticData;

        // Find matching stations
        const allResults = [];
        Object.values(staticData.stations).forEach(station => {
            if (!station.accessibility) return;

            const accLines = station.accessibility.split('\n');
            let hasElevator = false;
            let hasEscalator = false;
            let elevatorWorking = true;
            let escalatorWorking = true;

            // Parse each line of accessibility info
            accLines.forEach(line => {
                const lowerLine = line.toLowerCase();
                
                // Check for elevator mentions
                if (lowerLine.includes('ascensor')) {
                    hasElevator = true;
                    if (lowerLine.includes('fuera de servicio')) {
                        elevatorWorking = false;
                    }
                }
                
                // Check for escalator mentions
                if (lowerLine.includes('escala mecánica') || lowerLine.includes('escalera mecánica')) {
                    hasEscalator = true;
                    if (lowerLine.includes('fuera de servicio')) {
                        escalatorWorking = false;
                    }
                }
            });

            // Determine station status based on search scope
            let matchesStatus = false;
            let matchesEquipment = true;

            // Apply equipment filter if specified
            if (equipmentFilter) {
                if (equipmentFilter === 'ascensor') {
                    matchesEquipment = hasElevator;
                } else if (equipmentFilter === 'escalera') {
                    matchesEquipment = hasEscalator;
                } else if (equipmentFilter === 'ambos') {
                    matchesEquipment = hasElevator && hasEscalator;
                }
            }

            // Determine if matches requested status
            if (statusQuery === 'Operativa') {
                if (equipmentFilter === 'ascensor') {
                    matchesStatus = elevatorWorking;
                } else if (equipmentFilter === 'escalera') {
                    matchesStatus = escalatorWorking;
                } else if (equipmentFilter === 'ambos') {
                    matchesStatus = elevatorWorking && escalatorWorking;
                } else {
                    matchesStatus = (!hasElevator || elevatorWorking) && (!hasEscalator || escalatorWorking);
                }
            } else { // 'FueraServicio'
                if (equipmentFilter === 'ascensor') {
                    matchesStatus = !elevatorWorking;
                } else if (equipmentFilter === 'escalera') {
                    matchesStatus = !escalatorWorking;
                } else if (equipmentFilter === 'ambos') {
                    matchesStatus = !elevatorWorking && !escalatorWorking;
                } else {
                    matchesStatus = (hasElevator && !elevatorWorking) || (hasEscalator && !escalatorWorking);
                }
            }

            if (matchesStatus && matchesEquipment) {
                allResults.push({
                    id: station.id,
                    name: station.displayName,
                    line: station.line.toUpperCase(),
                    accessibility: station.accessibility,
                    color: styles.lineColors[station.line.toLowerCase()] || '#FFA500',
                    stationData: station
                });
            }
        });

        if (allResults.length === 0) {
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

        // Create and use the manager
        const manager = new AccessibilityResultsManager();
        const filters = {
            ascensor: equipmentFilter === 'ascensor' || equipmentFilter === 'ambos',
            escaleraMecanica: equipmentFilter === 'escalera' || equipmentFilter === 'ambos'
        };
        
        const messageData = await manager.build(
            statusQuery,
            filters,
            allResults,
            interaction.user.id
        );

        await interaction.editReply(messageData);
    }
};

