/**
 * @file stationUtils.js
 * @description Utilities for handling station data.
 */

const metroConfig = require('../config/metro/metroConfig');

const normalizedConnectionEmojis = Object.keys(metroConfig.connectionEmojis || {}).reduce((acc, key) => {
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

    if (station.connections && Array.isArray(station.connections)) {
        for (const conn of station.connections) {
            
            console.log(conn)
            
            if (conn.startsWith('l')) {
                connections.lines.push(conn);
            } else if (conn === 'Línea Cero' || conn === 'BiciMetro') {
                connections.bikes.push(conn);
            } else {
                connections.other.push(conn);
            }
        }
    }

    if (station.combinacion) {
        if (Array.isArray(station.combinacion)) {
            connections.lines.push(...station.combinacion);
        } else if (typeof station.combinacion === 'string') {
            connections.lines.push(station.combinacion);
        }
    }

    if (station.transports && typeof station.transports === 'string' && station.transports !== 'None') {
        const transportList = station.transports.split(',').map(item => item.trim());
        transportList.forEach(transport => {
            if (transport.toLowerCase().includes('bicicletero') || transport.toLowerCase().includes('lineacero')) {
                connections.bikes.push(transport);
            } else {
                connections.other.push(transport);
            }
        });
    } else if (station.transports && Array.isArray(station.transports)) {
        station.transports.forEach(transport => {
            if (transport.toLowerCase().includes('bicicletero') || transport.toLowerCase().includes('lineacero')) {
                connections.bikes.push(transport);
            } else {
                connections.other.push(transport);
            }
        });
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
    if (station.schematics?.[0]) {
        return station.schematics[0];
    }
    if (station.image) {
        return station.image;
    }
    return getLineImage(station.line);
}

function getLineImage(line) {
    return `https://www.metro.cl/images/lines/line-${line}.png`;
}

function processCommerceText(commerceText) {
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

function processAccessibilityText(accessibilityText) {
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

function decorateStation(station, decorations = []) {
    const stationName = station.nombre || station.name || '';
    const statusCode = station.estado || '1';
    const statusConfig = metroConfig.statusTypes?.[statusCode] || {};

    let rutaIcon = '';
    if (station.express_state === 'Operational' && station.route_color) {
        const routeColorMap = { 'R': 'roja', 'V': 'verde', 'C': 'comun' };
        const rutaKey = routeColorMap[station.route_color] || 'comun';
        rutaIcon = metroConfig.routeStyles[rutaKey]?.emoji || '';
    }

    let decoratedName = `${statusConfig.emoji || '❓'} ${rutaIcon} ${stationName}`.trim();

    if (decorations.includes('line_connections') && station.connections?.lines?.length > 0) {
        const connectionIcons = station.connections.lines.map(conn => {
            const normalizedConn = conn.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            return normalizedConnectionEmojis[normalizedConn] || '';
        }).join(' ');
        if (connectionIcons) {
            decoratedName += ` 🔄 ${connectionIcons}`;
        }
    }

    if (decorations.includes('other_connections') && station.connections?.other?.length > 0) {
        const connectionIcons = station.connections.other.map(conn => {
            const normalizedConn = conn.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            return normalizedConnectionEmojis[normalizedConn] || '';
        }).join(' ');
        if (connectionIcons) {
            decoratedName += ` ${connectionIcons}`;
        }
    }

    if (decorations.includes('bike_connections') && station.connections?.bikes?.length > 0) {
        decoratedName += ` 🚲`;
    }

    if (decorations.includes('platforms') && station.platforms) {
        const platformIcons = station.platforms.map(p => metroConfig.platformStatusIcons[p.status] || '').join(' ');
        if (platformIcons) {
            decoratedName += ` ${platformIcons}`;
        }
    }

    return decoratedName;
}

module.exports = {
    normalizeStationData,
    getPrimaryImage,
    getLineImage,
    processCommerceText,
    processAccessibilityText,
    decorateStation,
};
