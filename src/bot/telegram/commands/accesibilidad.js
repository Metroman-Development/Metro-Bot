const styles = require('../../../config/styles.json');

const { MetroInfoProvider } = require('../../../utils/MetroInfoProvider');
const DatabaseManager = require('../../../core/database/DatabaseManager');

module.exports = {
    name: 'accesibilidad',
    description: 'Buscar estaciones por estado de accesibilidad',
    async execute(ctx) {
        const args = ctx.message.text.split(' ').slice(1);
        if (args.length === 0) {
            return ctx.reply('Por favor, especifica un estado de accesibilidad (operativa/fueraservicio) y opcionalmente un tipo de equipo (ascensor/escalera/ambos).');
        }

        const statusQuery = args[0].toLowerCase() === 'operativa' ? 'Operativa' : 'FueraServicio';
        const equipmentFilter = args[1] ? args[1].toLowerCase() : null;

        const metroInfoProvider = MetroInfoProvider.getInstance();
        const db = await DatabaseManager.getInstance();

        // Get accessibility data from the database
        const accessibilityData = await db.getAccessibilityStatus();

        if (!accessibilityData || accessibilityData.length === 0) {
            return ctx.reply('No se encontró información de accesibilidad.');
        }

        // Process the data
        const stationData = {};
        const staticStations = metroInfoProvider.getFullData().stations;

        for (const item of accessibilityData) {
            const stationId = `${item.station_code}-${item.line_id}`;
            if (!stationData[stationId]) {
                const staticStation = staticStations[stationId];
                if (!staticStation) continue;

                stationData[stationId] = {
                    id: stationId,
                    name: staticStation.displayName,
                    line: item.line_id.toUpperCase(),
                    stationData: {
                        ...staticStation,
                        accessDetails: {
                            elevators: [],
                            escalators: []
                        }
                    },
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
            let message = `🔍 No se encontraron estaciones `;
            const statusText = statusQuery === 'Operativa' ? 'operativas' : 'con problemas de accesibilidad';

            message += statusText;

            if (equipmentFilter) {
                message += ' en ';
                if (equipmentFilter === 'ascensor') message += 'ascensores';
                else if (equipmentFilter === 'escalera') message += 'escaleras mecánicas';
                else message += 'ambos equipos';
            }
            return ctx.reply(message);
        }

        // Format the response for Telegram
        let response = `*Estaciones con accesibilidad: ${statusQuery === 'Operativa' ? 'Operativas' : 'Con problemas'}*\n\n`;
        allResults.forEach(station => {
            response += `*${station.name} (${station.line})*\n`;
            if (station.stationData.accessDetails.elevators.length > 0) {
                response += `  *Ascensores:*\n`;
                station.stationData.accessDetails.elevators.forEach(e => {
                    response += `    - ${e.text} (${e.status === 1 ? 'Operativo' : 'Fuera de servicio'})\n`;
                });
            }
            if (station.stationData.accessDetails.escalators.length > 0) {
                response += `  *Escaleras:*\n`;
                station.stationData.accessDetails.escalators.forEach(e => {
                    response += `    - ${e.text} (${e.status === 1 ? 'Operativo' : 'Fuera de servicio'})\n`;
                });
            }
            response += '\n';
        });

        return ctx.replyWithMarkdown(response);
    }
};
