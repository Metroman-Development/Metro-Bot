/**
 * @file stationUtils.js
 * @description Utilities for handling station data.
 */

const metroConfig = require('../config/metro/metroConfig');

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

module.exports = {
    normalizeStationData,
    getPrimaryImage,
    getLineImage,
    processCommerceText,
    processAccessibilityText,
};
