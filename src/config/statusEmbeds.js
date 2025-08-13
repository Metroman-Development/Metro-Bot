const metroConfig = require('./metro/metroConfig.js');

const styles = {};

const stations = {}; // Import stations.json

// Utility function to convert hex color to integer

function hexToInt(hex) {

    if (!hex || typeof hex !== 'string') return 0xFFFFFF;

    const cleanedHex = hex.startsWith('#') ? hex.slice(1) : hex;

    return parseInt(cleanedHex, 16) || 0xFFFFFF;

}

module.exports = {

    // Main overview embed with network status

    overviewEmbed: (data, timestamp) => {

        if (!data || typeof data !== 'object') {

            console.error('Invalid data provided to overviewEmbed.');

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

        // Collect all stations from all lines

        const allStations = Object.values(data).reduce((acc, line) => {

            return line.estaciones ? [...acc, ...line.estaciones] : acc;

        }, []);

        // Check if all stations are in "Cierre por Horario" state

        const allCierrePorHorario = allStations.every(s => s.descripcion_app === 'Cierre por Horario');

        // Build description based on operational status

        let description;

        if (allCierrePorHorario) {

            description = '🌙 **Cierre por Horario, Buenas Noches**';

        } else {

            // Check if all stations are operational

            const allOperational = allStations.every(s => s.descripcion_app === 'Habilitada');

            if (allOperational) {

                description = '✅ **Toda la Red Operativa**';

            } else {

                description = '⚠️ **Red no Operativa al 100%:**\n';

                const statusGroups = {};

                allStations.forEach(station => {

                    if (station.descripcion_app !== 'Habilitada') {

                        statusGroups[station.descripcion_app] =

                            [...(statusGroups[station.descripcion_app] || []), station.nombre];

                    }

                });

                for (const [status, stations] of Object.entries(statusGroups)) {

                    description += `**${status}:** ${stations.join(', ')}\n`;

                }

            }

        }

        // Build fields for lines

        const fields = Object.entries(data).map(([lineKey, lineData]) => {

            const lowercaseLineKey = lineKey.toLowerCase();

            const lineEmoji = metroConfig.linesEmojis?.[lowercaseLineKey] || '';

            const statusConfig = metroConfig.statusMapping?.[lineData.estado] || {};

            // Check if the line is in "Cierre por Horario" (using mensaje_app)

            const isCierrePorHorario = lineData.mensaje_app?.includes('Cierre por Horario');

            const lineStatus = isCierrePorHorario

                ? `🌙 ${lineData.mensaje_app}`

                : lineData.mensaje_app || statusConfig.message || 'Estado desconocido';

            return {

                name: `${lineEmoji} Línea ${lineKey.toUpperCase()}`,

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

    // Detailed embed for individual lines

   lineEmbed: (lineKey, lineData, timestamp) => {

    if (!lineKey || !lineData || typeof lineData !== 'object') {

        console.error('Invalid lineKey or lineData provided to lineEmbed.');

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

    const lowercaseLineKey = lineKey.toLowerCase();

    const lineColor = styles.lineColors?.[lowercaseLineKey] || styles.defaultTheme?.primaryColor;

    const lineEmoji = metroConfig.linesEmojis?.[lowercaseLineKey] || '';

    const displayLineKey = lineKey.replace(/^L/i, '').toUpperCase();

    // Handle estado 0 (🌙) or default status

    const lineStatus = lineData.estado === '0' ? '0' : lineData.estado;

    const statusConfig = lineData.estado === '0'

        ? { emoji: '🌙', message: 'Cierre por Horario' }

        : metroConfig.statusMapping?.[lineData.estado] || {};

    return {

        title: `${lineEmoji} Línea ${displayLineKey}`,

        description: `${statusConfig.emoji || '❓'} ${lineData.mensaje_app || statusConfig.message || 'Estado desconocido'}`,

        color: hexToInt(lineColor),

        fields: lineData.estaciones?.reduce((acc, station) => {

            const lastField = acc[acc.length - 1];

            // Clean station name

            const stationName = station.nombre

                .replace(/\s*L\d+[A-Za-z]*\s*$/, '')

                .trim();

            // Determine if station is in "Cierre por Horario"

            const isCierre = station.descripcion_app === 'Cierre por Horario';

            // Get base status icon

            let stationIcon;

            switch (station.estado) {

                case '1': stationIcon = metroConfig.stationIcons.operativa?.emoji || '✅'; break;

                case '2': stationIcon = metroConfig.stationIcons.cerrada?.emoji || '🟥'; break;

                case '3': stationIcon = metroConfig.stationIcons.parcial?.emoji || '🟨'; break;

                default: stationIcon = '❓';

            }

            // Add 🌙 prefix if in "Cierre por Horario"

            const stationStatusIcon = isCierre ? `🌙 ${stationIcon}` : stationIcon;

            // Get ruta emoji

            const stationRuta = stations[lowercaseLineKey]?.[stationName]?.ruta;

            let rutaKey = stationRuta?.replace('Ruta ', '').toLowerCase().replace('común', 'comun') || '';

            const rutaIcon = metroConfig.stationIcons[rutaKey]?.emoji || '';

            // Get combinación emoji

            let combinacionEmoji = '';

            if (station.combinacion) {

                const combinacionLineKey = station.combinacion.toLowerCase();

                combinacionEmoji = metroConfig.linesEmojis?.[combinacionLineKey] || '';

            }

            // Build station text

            let stationText = `${stationStatusIcon} ${rutaIcon} ${stationName}`;

            if (combinacionEmoji) stationText += ` 🔄 ${combinacionEmoji}`;

            // Add to fields

            if (lastField?.value.length + stationText.length < 1024) {

                lastField.value += `\n${stationText}`;

            } else {

                acc.push({ name: 'Estaciones', value: stationText, inline: false });

            }

            return acc;

        }, [{ name: 'Estaciones', value: '', inline: false }]) || [],

        footer: {

            text: `Actualizado: ${timestamp} • Información proporcionada por Metro de Santiago`,

            iconURL: 'https://metro.cl/logo.png'

        }

    };

}
};