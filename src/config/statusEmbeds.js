const metroConfig = require('./metro/metroConfig.js');
const logger = require('../events/logger');

const styles = require('./styles.json');

const stations = {}; // Import stations.json

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

        const { lines, systemMetadata } = data;

        const statusMessages = {
            operational: '✅ **Toda la Red Operativa**',
            degraded: '⚠️ **Red no Operativa al 100%**',
            outage: '🚨 **Red Suspendida**',
            closed: '🌙 **Cierre por Horario, Buenas Noches**',
            default: '❓ **Estado Desconocido**'
        };

        const networkStatus = systemMetadata?.status || 'default';
        const description = statusMessages[networkStatus] || statusMessages.default;

        const fields = Object.values(lines).map(line => {
            const lineKey = line.id.toLowerCase();
            const lineEmoji = metroConfig.linesEmojis?.[lineKey] || '';
            const statusConfig = metroConfig.statusTypes?.[line.status.code] || {};

            const isClosed = line.status.code === '0' || line.status.message?.includes('Cierre por Horario');
            const lineStatus = isClosed
                ? `🌙 Cierre por Horario`
                : line.status.message || statusConfig.description || 'Estado desconocido';

            const lineName = line.displayName || line.name || '';
            return {
                name: `${lineEmoji} Línea ${lineName.replace('Línea ', '')}`,
                value: `${statusConfig.emoji || '❓'} ${lineStatus}`,
                inline: true
            };
        });

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
        const lineName = lineData.displayName || lineData.name || '';
        const displayLineKey = lineName.replace('Línea ', '');

        const statusConfig = metroConfig.statusTypes?.[lineData.status.code] || {};
        const isClosed = lineData.status.code === '0' || lineData.status.message?.includes('Cierre por Horario');
        const description = isClosed
            ? `🌙 Cierre por Horario`
            : `${statusConfig.emoji || '❓'} ${lineData.status.message || statusConfig.description || 'Estado desconocido'}`;

        const stationObjects = (lineData.stations || [])
            .map(stationId => stations[stationId])
            .filter(Boolean);

        const stationLines = stationObjects.map(station => {
            const stationName = station.name.replace(/\s*L\d+[A-Za-z]*\s*$/, '').trim();
            const isStationClosed = station.status.code === '0';
            const stationIcon = metroConfig.statusTypes[station.status.code]?.emoji || '❓';
            const stationStatusIcon = isStationClosed ? `🌙 ${stationIcon}` : stationIcon;

            const rutaKey = station.route?.replace('Ruta ', '').toLowerCase().replace('común', 'comun') || '';
            const rutaIcon = metroConfig.routeStyles[rutaKey]?.emoji || '';

            let combinacionEmoji = '';
            const transferLines = station.transferLines || (station.transfer ? (Array.isArray(station.transfer) ? station.transfer : [station.transfer]) : []);

            if (transferLines.length > 0) {
                combinacionEmoji = transferLines
                    .map(lineId => metroConfig.linesEmojis?.[String(lineId).toLowerCase()] || '')
                    .join(' ');
            }

            let stationText = `${stationStatusIcon} ${rutaIcon} ${stationName}`;
            if (combinacionEmoji) stationText += ` 🔄 ${combinacionEmoji}`;

            return stationText;
        });

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