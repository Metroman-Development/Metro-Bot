/**
 * @file stationUtils.js
 * @description Utilities for handling station data.
 */

const metroConfig = require('../config/metro/metroConfig');

const normalizedConnectionEmojis = Object.keys(metroConfig.connectionEmojis || {}).reduce((acc, key) => {
    const normalizedKey = key.toLowerCase();
    acc[normalizedKey] = metroConfig.connectionEmojis[key];
    return acc;
}, {});

function normalizeStationData(station) {
    return {
        ...station,
        transferLines: station.transferLines || (station.combination ? [station.combination] : []),
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

    if (decorations.includes('connections')) {
        let allConnections = [];
        if (station.connections && Array.isArray(station.connections)) {
            allConnections = [...station.connections];
        }
        if (station.amenities && typeof station.amenities === 'string') {
            const amenitiesList = station.amenities.split(',').map(item => item.trim());
            allConnections = [...allConnections, ...amenitiesList];
        } else if (station.amenities && Array.isArray(station.amenities)) {
            allConnections = [...allConnections, ...station.amenities];
        }

        if (station.transports && typeof station.transports === 'string' && station.transports !== 'None') {

            const transportList = station.transports.split(',').map(item => item.trim());
            allConnections = [...allConnections, ...transportList];
        } else if (station.transports && Array.isArray(station.transports)) {
            allConnections = [...allConnections, ...station.transports];
        }

        if (allConnections.length > 0) {
            
            console.log(allConnections)
            console.log(normalizedConnectionEmojis)
            
            const connectionIcons = allConnections.map(conn => {
                
                const normalizedConn = conn.toLowerCase();
                return normalizedConnectionEmojis[normalizedConn] || '';
            }).join(' ');
            if (connectionIcons) {
                decoratedName += ` ${connectionIcons}`;
            }
        }
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
