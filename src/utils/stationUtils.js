/**
 * @file stationUtils.js
 * @description Utilities for handling station data.
 */

const normalizedConnectionEmojis = (metroConfig) => Object.keys(metroConfig.connectionEmojis || {}).reduce((acc, key) => {
    const normalizedKey = key.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    acc[normalizedKey] = metroConfig.connectionEmojis[key];
    return acc;
}, {});

function normalizeStationData(station) {
    const connections = {
        lines: [],
        other: [],
        bikes: []
    };

    let stationConnections = station.connections;
    if (typeof stationConnections === 'string') {
        try {
            stationConnections = JSON.parse(stationConnections);
        } catch (e) {
            stationConnections = null;
        }
    }

    if (stationConnections && Array.isArray(stationConnections)) {
        for (const conn of stationConnections) {
            if (conn.startsWith('l')) {
                connections.lines.push(conn);
            } else if (conn === 'Línea Cero' || conn === 'BiciMetro' || conn === 'U Invertida') {
                connections.bikes.push(conn);
            } else {
                connections.other.push(conn);
            }
        }
    }

    if (station.transfer) {
        if (Array.isArray(station.transfer)) {
            connections.lines.push(...station.transfer);
        } else if (typeof station.transfer === 'string') {
            connections.lines.push(station.transfer);
        }
    }

    if (station.amenities && typeof station.amenities === 'string' && station.amenities !== 'None') {
        const amenitiesList = station.amenities.split(',').map(item => item.trim());
        connections.other.push(...amenitiesList);
    } else if (station.amenities && Array.isArray(station.amenities)) {
        connections.other.push(...station.amenities);
    }

    // remove duplicates
    connections.lines = [...new Set(connections.lines)];
    connections.other = [...new Set(connections.other)];
    connections.bikes = [...new Set(connections.bikes)];

    return {
        ...station,
        connections: connections,
        accessibility: station.accessibility === 'None' ? null : station.accessibility,
        commerce: station.commerce === 'None' ? null : station.commerce,
        amenities: station.amenities === 'None' ? null : station.amenities
    };
}

function getPrimaryImage(station) {
    if (station.accessDetails?.[0]) {
        return station.accessDetails[0];
    }
    if (station.image) {
        return station.image;
    }
    return getLineImage(station.line);
}

function getLineImage(line) {
    return `https://www.metro.cl/images/lines/line-${line}.png`;
}

function processCommerceText(commerceText, metroConfig) {
    if (!commerceText) return 'No disponible';

    const commerceList = commerceText.split(',').map(item => item.trim());
    return commerceList.map(item => {
        if (metroConfig.commerce?.[item]) {
            return metroConfig.commerce[item];
        }

        const combinedMatch = Object.keys(metroConfig.commerce || {}).find(name =>
            item.toLowerCase().includes(name.toLowerCase())
        );

        if (combinedMatch) {
            let result = item;
            Object.keys(metroConfig.commerce).forEach(name => {
                if (item.toLowerCase().includes(name.toLowerCase())) {
                    result = result.replace(new RegExp(name, 'gi'), metroConfig.commerce[name]);
                }
            });
            return result;
        }

        return `*${item}*`;
    }).join(', ');
}

function processAccessibilityText(accessibilityText, metroConfig) {
    if (!accessibilityText) return ["No hay información de accesibilidad"];

    const accessibilityLines = accessibilityText.split('\n');
    return accessibilityLines.map(line => {
        let processedLine = line;

        // Replace line references with emojis
        processedLine = processedLine.replace(/Línea (\d+[a-z]?)/gi, (match, lineNum) => {
            const lineKey = `l${lineNum.toLowerCase()}`;
            return metroConfig.linesEmojis[lineKey] || match;
        });

        // Replace access letters with emojis (A, B, C, etc.)
        processedLine = processedLine.replace(/\(([a-z])\)/gi, (match, letter) => {
            const upperLetter = letter.toUpperCase();
            return String.fromCodePoint(0x1F170 + upperLetter.charCodeAt(0) - 65) + (upperLetter > 'A' ? '' : '️');
        });

        // Replace access labels with emojis
        processedLine = processedLine.replace(/Acceso ([A-Z])/gi, (match, letter) => {
            const emojiCode = 0x1F170 + letter.charCodeAt(0) - 65;
            return `Acceso ${String.fromCodePoint(emojiCode)}`;
        });

        // Normalize for comparison
        const lowerLine = processedLine.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

        if (lowerLine.includes('todos los ascensores disponibles') ||
            lowerLine.match(/todos los ascensores (operativos|disponibles)/)) {
            return `${metroConfig.accessibility?.estado?.ope || '✅'} ${processedLine}`;
        }

        if (lowerLine.includes('ascensor') || lowerLine.includes('ascensores')) {
            if (lowerLine.includes('fuera de servicio') || lowerLine.includes('no disponible')) {
                return `${metroConfig.accessibility?.estado?.fes || '⛔'} ${processedLine}`;
            }
            return `${metroConfig.accessibility?.ascensor || '🛗'} ${processedLine}`;
        }

        if (lowerLine.includes('salida de estación') ||
            lowerLine.includes('a nivel de vereda') ||
            lowerLine.includes('a nivel de calle')) {
            return `${metroConfig.accessibility?.salida || '🚪'} ${processedLine}`;
        }

        return processedLine;
    });
}

function decorateStation(station, decorations = [], metroInfoProvider) {
    if (!metroInfoProvider) {
        throw new Error("decorateStation requires a metroInfoProvider instance.");
    }
    const metroConfig = metroInfoProvider.getConfig();
    const stationName = station.display_name || station.name || '';
    let statusConfig = metroConfig.statusTypes?.['default']; // Default status

    let is_operational = station.is_operational;
    let status_name = station.status_name;

    if (station.status_data) {
        is_operational = station.status_data.is_operational;
        status_name = station.status_data.status_name;
    }

    if (typeof is_operational !== 'undefined') {
        if (is_operational === 0) { // Not operational
            if (status_name) {
                const statusType = Object.values(metroConfig.statusTypes).find(st => st.name === status_name && !st.isOperational);
                if (statusType) {
                    statusConfig = statusType;
                } else {
                    statusConfig = metroConfig.statusTypes['5']; // 'cerrada'
                }
            } else {
                statusConfig = metroConfig.statusTypes['5']; // 'cerrada'
            }
        } else { // Operational
             if (status_name) {
                const statusType = Object.values(metroConfig.statusTypes).find(st => st.name === status_name && st.isOperational);
                if (statusType) {
                    statusConfig = statusType;
                } else {
                    statusConfig = metroConfig.statusTypes['1']; // 'abierta'
                }
            } else {
                statusConfig = metroConfig.statusTypes['1']; // 'abierta'
            }
        }
    } else {
        const statusCode = station.status || '1';
        statusConfig = metroConfig.statusTypes?.[statusCode] || statusConfig;
    }

    let rutaIcon = '';
    if (station.express_state === 'Operational' && station.route_color) {
        const routeColorMap = { 'R': 'roja', 'V': 'verde', 'C': 'comun' };
        const rutaKey = routeColorMap[station.route_color] || 'comun';
        rutaIcon = metroConfig.routeStyles[rutaKey]?.emoji || '';
    }

    let decoratedName = `${statusConfig.discordem || '❓'} ${rutaIcon} ${stationName}`.trim();

    if (decorations.includes('line_connections') && station.transfer) {
       
            decoratedName += ` 🔄 ${metroConfig.linesEmojis[station.transfer.toLowerCase()]}`;
        
    }

    if (decorations.includes('transports') && station.transports) {

        const transportsArray = station.transports.split(', ')

        const connectionIcons = transportsArray.map(trans => {
            const normalizedConn = trans.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            return normalizedConnectionEmojis(metroConfig)[normalizedConn] || '';
        }).join(' ');
        if (connectionIcons) {
            decoratedName += ` ${connectionIcons}`;
        }
        
    }

    if (decorations.includes('other_connections') && station.connections?.length > 0) {
        const connectionIcons = station.connections.map(conn => {
            const normalizedConn = conn.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(" ", "");
            return normalizedConnectionEmojis(metroConfig)[normalizedConn] || '';
        }).join(' ');
        if (connectionIcons) {
            decoratedName += ` ${connectionIcons}`;
        }
    }

    if (decorations.includes('bike_connections') && station.connections?.bikes?.length > 0) {
        decoratedName += ` 🚲`;
    }

    if (decorations.includes('platforms') && station.platforms) {
        const platformIcons = Object.values(station.platforms).map(status => metroConfig.platformStatusIcons[status] || '').join(' ');
        if (platformIcons) {
            decoratedName += ` ${platformIcons}`;
        }
    }

    return decoratedName;
}

function getStationStatusEmoji(station, metroConfig) {
    let statusConfig = metroConfig.statusTypes?.['default']; // Default status

    let is_operational = station.is_operational;
    let status_name = station.status_name;

    if (station.status_data) {
        is_operational = station.status_data.is_operational;
        status_name = station.status_data.status_name;
    }

    if (typeof is_operational !== 'undefined') {
        if (is_operational === 0) { // Not operational
            if (status_name) {
                const statusType = Object.values(metroConfig.statusTypes).find(st => st.name === status_name && !st.isOperational);
                if (statusType) {
                    statusConfig = statusType;
                } else {
                    statusConfig = metroConfig.statusTypes['5']; // 'cerrada'
                }
            } else {
                statusConfig = metroConfig.statusTypes['5']; // 'cerrada'
            }
        } else { // Operational
             if (status_name) {
                const statusType = Object.values(metroConfig.statusTypes).find(st => st.name === status_name && st.isOperational);
                if (statusType) {
                    statusConfig = statusType;
                } else {
                    statusConfig = metroConfig.statusTypes['1']; // 'abierta'
                }
            } else {
                statusConfig = metroConfig.statusTypes['1']; // 'abierta'
            }
        }
    } else {
        const statusCode = station.status || '1';
        statusConfig = metroConfig.statusTypes?.[statusCode] || statusConfig;
    }
    return statusConfig.discordem || '❓';
}

module.exports = {
    normalizeStationData,
    getPrimaryImage,
    getLineImage,
    processCommerceText,
    processAccessibilityText,
    decorateStation,
    getStationStatusEmoji,
};
