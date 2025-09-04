const logger = require('../events/logger');
const styles = require('./styles.json');
const TimeHelpers = require('../utils/timeHelpers.js');
const { decorateStation, getStationStatusEmoji } = require('../utils/stationUtils.js');

// Utility function to convert hex color to integer
function hexToInt(hex) {
    if (!hex || typeof hex !== 'string') return 0xFFFFFF;
    const cleanedHex = hex.startsWith('#') ? hex.slice(1) : hex;
    return parseInt(cleanedHex, 16) || 0xFFFFFF;
}

module.exports = {
    overviewEmbed: (metroInfoProvider, timestamp) => {
        const data = metroInfoProvider.getFullData();
        if (!data || !data.lines || typeof data.lines !== 'object') {
            return {
                title: '🚇 Estado General de la Red Metro',
                description: '⚠️ No se pudo obtener la información del Metro.',
                color: hexToInt(styles.defaultTheme?.primaryColor),
                footer: {
                    text: `Actualizado: ${timestamp} • Información proporcionada por Metro de Santiago`,
                    iconURL: 'https://metro.cl/logo.png'
                }
            };
        }

        const { lines, network_status } = data;
        const metroConfig = metroInfoProvider.getConfig();

        const statusMessages = {
            operational: '✅ **Toda la Red Operativa**',
            degraded: '⚠️ **Red no Operativa al 100%**',
            outage: '🚨 **Red Suspendida**',
            closed: '🌙 **Cierre por Horario, Buenas Noches**',
            default: '❓ **Estado Desconocido**'
        };

        const networkStatus = network_status?.status || 'default';
        const description = statusMessages[networkStatus] || statusMessages.default;

        const fields = Object.values(lines)
            .filter(line => line && typeof line === 'object' && line.id)
            .map(line => {
            const lineKey = line.id.toLowerCase();
            const lineEmoji = metroConfig.linesEmojis?.[lineKey] || '';

            const statusCode = line.status_data?.status_name || 'operational';
            const statusConfig = metroConfig.statusTypes?.[statusCode] || {};

            const isClosed = statusCode === 'closed' || line.app_message?.includes('Cierre por Horario');
            const lineStatus = isClosed
                ? `🌙 Cierre por Horario`
                : line.status_data?.status_description || 'Estado desconocido';

            const lineName = line.name || line.displayName || '';
            return {
                name: `${lineEmoji} Línea ${lineName.replace('Línea ', '')}`,
                value: `${statusConfig.emoji || '❓'} ${lineStatus}`,
                inline: true
            };
        });

        const serviceStatus = TimeHelpers.getOperatingHours();
        if (serviceStatus) {
            fields.push({
                name: '🕒 Horario de Servicio',
                value: `${serviceStatus.opening} - ${serviceStatus.closing}`,
                inline: false
            });
        }

        const currentPeriod = TimeHelpers.getCurrentPeriod();
        if (currentPeriod) {
            fields.push({
                name: '💲 Periodo Tarifario',
                value: currentPeriod.name,
                inline: true
            });
        }

        const nextTransition = TimeHelpers.getNextTransition();
        if (nextTransition) {
            fields.push({
                name: '⏭️ Próximo Cambio',
                value: `${nextTransition.time}: ${nextTransition.message}`,
                inline: true
            });
        }

        return {
            title: '🚇 Estado General de la Red Metro',
            description,
            color: hexToInt(styles.defaultTheme?.primaryColor),
            fields,
            footer: {
                text: `Actualizado: ${timestamp} • Información proporcionada por Metro de Santiago`,
                iconURL: 'https://metro.cl/logo.png'
            }
        };
    },

    lineEmbed: (lineId, metroInfoProvider, timestamp) => {
        const lineData = metroInfoProvider.getLine(lineId);
        const stations = metroInfoProvider.getStations();
        const metroConfig = metroInfoProvider.getConfig();
        
        logger.info(`[EmbedManager] Generating embed for line: ${lineData.id}`);
        if (!lineData) {
            return {
                title: '🚇 Estado de la Línea',
                description: '⚠️ No se pudo obtener la información de la línea.',
                color: hexToInt(styles.defaultTheme?.primaryColor),
                footer: {
                    text: `Actualizado: ${timestamp} • Información proporcionada por Metro de Santiago`,
                    iconURL: 'https://metro.cl/logo.png'
                }
            };
        }

        const lineKey = lineData.id.toLowerCase();
        const lineColor = styles.lineColors?.[lineKey] || styles.defaultTheme?.primaryColor;
        const lineEmoji = metroConfig.linesEmojis?.[lineKey] || '';

        const lineName = lineData.name || lineData.displayName || '';
        const displayLineKey = lineName.replace('Línea ', '');

        const stationObjects = (stations ? Object.values(stations) : [])
            .filter(station => station.line_id === lineData.id);

        const stationLines = stationObjects.map(station => {
            return decorateStation(station, ['line_connections', 'other_connections', 'bike_connections', 'platforms', 'transports'], metroInfoProvider);
        });

        const stationStatuses = stationObjects.map(station => getStationStatusEmoji(station, metroConfig));
        const uniqueStatuses = [...new Set(stationStatuses)];

        let description = '';
        if (uniqueStatuses.length === 1) {
            const statusConfig = Object.values(metroConfig.statusTypes).find(st => st.discordem === uniqueStatuses[0]);
            description = `${uniqueStatuses[0]} ${statusConfig?.description || 'Estado desconocido'}`;
        } else {
            description = '⚠️ Estado mixto en la línea.';
        }

        if (lineData.app_message?.includes('Cierre por Horario')) {
            description = `🌙 Cierre por Horario`;
        }

        if (lineData.express_status) {
            const expressStatus = lineData.express_status === 'active' ? 'Activo' : 'Inactivo';
            description += `\n**Ruta Expresa:** ${expressStatus}`;
        }

        const maxChars = 1024;
        let stationFields = [];

        if (stationLines.length > 0) {
            let currentFieldValue = "";
            let isFirstField = true;

            for (const stationLine of stationLines) {
                if (currentFieldValue.length + stationLine.length + 1 > maxChars) {
                    stationFields.push({
                        name: isFirstField ? 'Estaciones' : '\u200B',
                        value: currentFieldValue,
                        inline: false
                    });
                    currentFieldValue = "";
                    isFirstField = false;
                }
                currentFieldValue += stationLine + '\n';
            }

            if (currentFieldValue.length > 0) {
                stationFields.push({
                    name: isFirstField ? 'Estaciones' : '\u200B',
                    value: currentFieldValue,
                    inline: false
                });
            }
        }

        return {
            title: `${lineEmoji} Línea ${displayLineKey}`,
            description,
            color: hexToInt(lineColor),
            fields: stationFields,
            footer: {
                text: `Actualizado: ${timestamp} • Información proporcionada por Metro de Santiago`,
                iconURL: 'https://metro.cl/logo.png'
            }
        };
    }
};
