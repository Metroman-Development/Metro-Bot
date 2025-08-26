const metroConfig = require('./metro/metroConfig.js');
const logger = require('../events/logger');
const styles = require('./styles.json');
const TimeHelpers = require('../utils/timeHelpers.js');
const { decorateStation } = require('../utils/stationUtils.js');

// Utility function to convert hex color to integer
function hexToInt(hex) {
    if (!hex || typeof hex !== 'string') return 0xFFFFFF;
    const cleanedHex = hex.startsWith('#') ? hex.slice(1) : hex;
    return parseInt(cleanedHex, 16) || 0xFFFFFF;
}

module.exports = {
    overviewEmbed: (data, timestamp) => {
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

        const statusMessages = {
            operational: '✅ **Toda la Red Operativa**',
            degraded: '⚠️ **Red no Operativa al 100%**',
            outage: '🚨 **Red Suspendida**',
            closed: '🌙 **Cierre por Horario, Buenas Noches**',
            default: '❓ **Estado Desconocido**'
        };

        const networkStatus = network_status?.status || 'default';
        const description = statusMessages[networkStatus] || statusMessages.default;

        const fields = Object.values(lines).map(line => {
            const lineKey = line.id.toLowerCase();
            const lineEmoji = metroConfig.linesEmojis?.[lineKey] || '';

            const statusCode = line.estado || line.status || '1';
            const statusConfig = metroConfig.statusTypes?.[statusCode] || {};

            const isClosed = statusCode === '0' || line.mensaje_app?.includes('Cierre por Horario');
            const lineStatus = isClosed
                ? `🌙 Cierre por Horario`
                : line.mensaje_app || statusConfig.description || 'Estado desconocido';

            const lineName = line.nombre || line.displayName || '';
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

    lineEmbed: (lineData, stations, timestamp) => {
        
        console.log(stations)
        
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

        const lineName = lineData.nombre || lineData.displayName || '';
        const displayLineKey = lineName.replace('Línea ', '');

        const statusCode = lineData.estado || lineData.status || '1';
        const statusConfig = metroConfig.statusTypes?.[statusCode] || {};
        const isClosed = statusCode === '0' || lineData.mensaje_app?.includes('Cierre por Horario');
        const description = isClosed
            ? `🌙 Cierre por Horario`
            : `${statusConfig.emoji || '❓'} ${lineData.mensaje_app || statusConfig.description || 'Estado desconocido'}`;

        const stationObjects = (lineData.stations || []);
        const stationLines = stationObjects.map(station => {
            const decoratedStation = decorateStation(station, ['connections', 'platforms']);

            let rutaIcon = '';
            if (station.express_state === 'Operational') {
                const routeColorMap = { 'R': 'roja', 'V': 'verde', 'C': 'comun' };
                const rutaKey = routeColorMap[station.route_color] || 'comun';
                rutaIcon = metroConfig.routeStyles[rutaKey]?.emoji || '';
            }

            let combinacionEmoji = '';
            const transferLines = Array.isArray(station.combinacion) ? station.combinacion : (station.transferLines || []);

            if (transferLines.length > 0) {
                combinacionEmoji = transferLines
                    .map(lineId => metroConfig.linesEmojis?.[String(lineId).toLowerCase()] || '')
                    .join(' ');
            }

            let stationText = `${decoratedStation} ${rutaIcon}`;
            if (combinacionEmoji) stationText += ` 🔄 ${combinacionEmoji}`;

            return stationText;
        });

        if (lineData.express_status) {
            const expressStatus = lineData.express_status === 'active' ? 'Activo' : 'Inactivo';
            description += `\n**Ruta Expresa:** ${expressStatus}`;
        }

        let stationListString = stationLines.join('\n');
        const maxChars = 1024;
        let stationFields = [];

        if (stationListString.length > 0) {
            if (stationListString.length > maxChars) {
                let truncatedString = stationListString.substring(0, maxChars);
                const lastNewlineIndex = truncatedString.lastIndexOf('\n');
                if (lastNewlineIndex > 0) {
                    truncatedString = truncatedString.substring(0, lastNewlineIndex);
                }
                stationListString = truncatedString + '\n...';
            }
            stationFields.push({ name: 'Estaciones', value: stationListString, inline: false });
        }

        const nextTransition = TimeHelpers.getNextTransition();
        if (nextTransition) {
            stationFields.push({
                name: '⏭️ Próximo Cambio',
                value: `${nextTransition.time}: ${nextTransition.message}`,
                inline: true
            });
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
