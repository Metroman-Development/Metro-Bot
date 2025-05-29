// _buscaraccesibilidad.js - Updated to support both old and new formats
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
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


          //  console.log(station) 
            
            // Check if station uses new format (accessibility object)
            if (station.accessDetails && station.accessDetails.accesses?.length >0) {
                const newFormatResult = this.processNewFormat(station, statusQuery, equipmentFilter);
                if (newFormatResult) {
                    allResults.push(newFormatResult);
                }
            } 
            // Old format (text block)
            else if (typeof station.accessibility === 'string') {
                const oldFormatResult = this.processOldFormat(station, statusQuery, equipmentFilter);
                if (oldFormatResult) {
                    allResults.push(oldFormatResult);
                }
            }
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
            fueraDeServicio : statusQuery !== 'Operativa'
        
        };
        
        const messageData = await manager.build(
            statusQuery,
            filters,
            allResults,
            interaction.user.id
        );

        await interaction.editReply(messageData);
    },

    /**
     * Processes stations with the new accessibility format (object with structured data)
     */
    processNewFormat(station, statusQuery, equipmentFilter) {
        const accData = station.accessDetails;
        let hasElevator = accData.elevators?.length > 0;
        let hasEscalator = accData.escalators?.length > 0;

       // console.log(accData) 
        
        // Check equipment status
        let elevatorStatus = hasElevator 
            ? accData.elevators.some(e => e.status && e.status.toLowerCase().includes('fuera de servicio')) 
                ? 'FueraServicio' : 'Operativa'
            : null;
            
        let escalatorStatus = hasEscalator 
            ? accData.escalators.some(e => e.status && e.status.toLowerCase().includes('fuera')) 
                ? 'FueraServicio' : 'Operativa'
            : null;

        console.log(accData.escalators)

        console.log(escalatorStatus)
        // Apply equipment filter
        let matchesEquipment = true;
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
        let matchesStatus = false;
        if (statusQuery === 'Operativa') {
            if (equipmentFilter === 'ascensor') {
                matchesStatus = elevatorStatus === 'Operativa';
            } else if (equipmentFilter === 'escalera') {
                matchesStatus = escalatorStatus === 'Operativa';
            } else if (equipmentFilter === 'ambos') {
                matchesStatus = (elevatorStatus === 'Operativa') && (escalatorStatus === 'Operativa');
            } else {
                matchesStatus = (!hasElevator || elevatorStatus === 'Operativa') && 
                               (!hasEscalator || escalatorStatus === 'Operativa');
            }
        } else { // 'FueraServicio'
            if (equipmentFilter === 'ascensor') {
                matchesStatus = elevatorStatus === 'FueraServicio';
            } else if (equipmentFilter === 'escalera') {
                matchesStatus = escalatorStatus === 'FueraServicio';
            } else if (equipmentFilter === 'ambos') {
                matchesStatus = (elevatorStatus === 'FueraServicio') && (escalatorStatus === 'FueraServicio');
            } else {
                matchesStatus = (hasElevator && elevatorStatus === 'FueraServicio') || 
                               (hasEscalator && escalatorStatus === 'FueraServicio');
            }
        }

        if (matchesStatus && matchesEquipment) {
            return {
                id: station.id,
                name: station.displayName,
                line: station.line.toUpperCase(),
                accessibility: this.formatNewAccessibilityText(accData),
                color: styles.lineColors[station.line.toLowerCase()] || '#FFA500',
                stationData: station,
                isNewFormat: true
            };
        }
        return null;
    },

    /**
     * Processes stations with the old accessibility format (text block)
     */
    processOldFormat(station, statusQuery, equipmentFilter) {
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

        // Apply equipment filter if specified
        let matchesEquipment = true;
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
        let matchesStatus = false;
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
            return {
                id: station.id,
                name: station.displayName,
                line: station.line.toUpperCase(),
                accessibility: station.accessibility,
                color: styles.lineColors[station.line.toLowerCase()] || '#FFA500',
                stationData: station,
                isNewFormat: false
            };
        }
        return null;
    },

    /**
     * Formats new format accessibility data into readable text
     */
    formatNewAccessibilityText(accData) {
        const lines = [];
        
        // Add accesses
        if (accData.accesses.length > 0) {
            lines.push('**Accesos:**');
            accData.accesses.forEach(access => {
                let line = `- ${access.name}`;
                if (access.description) line += ` (${access.description})`;
                if (access.status) line += ` [${access.status}]`;
                lines.push(line);
            });
        }
        
        // Add elevators
        if (accData.elevators.length > 0) {
            lines.push('\n**Ascensores:**');
            accData.elevators.forEach(elevator => {
                let line = `- ${elevator.id}: ${elevator.from} → ${elevator.to}`;
                if (elevator.status) line += ` [${elevator.status}]`;
                lines.push(line);
            });
        }
        
        // Add escalators
        if (accData.escalators.length > 0) {
            lines.push('\n**Escaleras Mecánicas:**');
            accData.escalators.forEach(escalator => {
                let line = `- ${escalator.id}: ${escalator.from} → ${escalator.to}`;
                if (escalator.status) line += ` [${escalator.status}]`;
                lines.push(line);
            });
        }
        
        return lines.join('\n');
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
