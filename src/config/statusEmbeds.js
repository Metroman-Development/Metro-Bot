const metroConfig = require('./metro/metroConfig.js');

const styles = require('./styles.json');

const stations = {}; // Import stations.json

// Utility function to convert hex color to integer

function hexToInt(hex) {

    if (!hex || typeof hex !== 'string') return 0xFFFFFF;

    const cleanedHex = hex.startsWith('#') ? hex.slice(1) : hex;

    return parseInt(cleanedHex, 16) || 0xFFFFFF;

}

module.exports = {
    overviewEmbed: (network, lines, timestamp) => {
        if (!network || !lines || typeof lines !== 'object') {
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

        const statusMessages = {
            operational: '✅ **Toda la Red Operativa**',
            degraded: '⚠️ **Red no Operativa al 100%**',
            outage: '🚨 **Red Suspendida**',
            closed: '🌙 **Cierre por Horario, Buenas Noches**',
            default: '❓ **Estado Desconocido**'
        };

        const description = statusMessages[network.status] || statusMessages.default;

        const fields = Object.values(lines).map(line => {
            const lineKey = line.id.toLowerCase();
            const lineEmoji = metroConfig.linesEmojis?.[lineKey] || '';
            const statusConfig = metroConfig.statusTypes?.[line.status] || {};

            const isClosed = line.status === '0' || line.message?.includes('Cierre por Horario');
            const lineStatus = isClosed
                ? `🌙 Cierre por Horario`
                : line.message || statusConfig.description || 'Estado desconocido';

            return {
                name: `${lineEmoji} Línea ${line.name.replace('Línea ', '')}`,
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

    lineEmbed: (lineData, allStations, timestamp) => {
        if (!lineData || !allStations) {
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
        const displayLineKey = lineData.name.replace('Línea ', '');

        const statusConfig = metroConfig.statusTypes?.[lineData.status] || {};
        const isClosed = lineData.status === '0' || lineData.message?.includes('Cierre por Horario');
        const description = isClosed
            ? `🌙 Cierre por Horario`
            : `${statusConfig.emoji || '❓'} ${lineData.message || statusConfig.description || 'Estado desconocido'}`;

        const stationFields = lineData.stations.reduce((acc, stationId) => {
            const station = allStations[stationId];
            if (!station) return acc;

            const lastField = acc[acc.length - 1];
            const stationName = station.name.replace(/\s*L\d+[A-Za-z]*\s*$/, '').trim();
            const isStationClosed = station.status === '0';
            const stationIcon = metroConfig.statusTypes[station.status]?.emoji || '❓';
            const stationStatusIcon = isStationClosed ? `🌙 ${stationIcon}` : stationIcon;

            const rutaKey = station.route?.replace('Ruta ', '').toLowerCase().replace('común', 'comun') || '';
            const rutaIcon = metroConfig.routeStyles[rutaKey]?.emoji || '';

            let combinacionEmoji = '';
            if (station.transfer) {
                const combinacionLineKey = station.transfer.toLowerCase();
                combinacionEmoji = metroConfig.linesEmojis?.[combinacionLineKey] || '';
            }

            let stationText = `${stationStatusIcon} ${rutaIcon} ${stationName}`;
            if (combinacionEmoji) stationText += ` 🔄 ${combinacionEmoji}`;

            if (lastField?.value.length + stationText.length < 1024) {
                lastField.value += `\n${stationText}`;
            } else {
                acc.push({ name: 'Estaciones', value: stationText, inline: false });
            }
            return acc;
        }, [{ name: 'Estaciones', value: '', inline: false }]);

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