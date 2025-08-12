// utils/lineUtils.js
const { getCachedMetroData } = require('../events/metroDataHandler');
const linesData = require('../data/linesData.json');
const { isExpressActive } = require('./timeUtils');

// --------------------------
// Core Constants
// --------------------------

const EXPRESS_LINES = new Set(['l2', 'l4', 'l5']);

// --------------------------
// Helper Functions
// --------------------------

/**
 * Check if a line has express routes.
 * @param {string} lineInput - The line identifier (e.g., "l2", "2", "Línea 2").
 * @returns {boolean} True if the line has express routes.
 */
function hasExpressRoute(lineInput) {
    const normalized = String(lineInput || '')
        .toLowerCase()
        .replace(/[^0-9a-z]|linea?/gi, '');
    return EXPRESS_LINES.has(`l${normalized}`) || EXPRESS_LINES.has(normalized);
}

/**
 * Get line data by merging cached data and static JSON.
 * @param {string} lineKey - The line identifier (e.g., "l1").
 * @returns {Object} Merged line data.
 */
function getLineData(lineKey) {
    const metroData = getCachedMetroData();
    if (!metroData) {
        console.error('❌ metroData is undefined or could not be loaded.');
        return null;
    }

    const lineInfo = metroData[lineKey];
    if (!lineInfo) {
        console.error(`❌ No data found for line: ${lineKey}`);
        return null;
    }

    const lineDataFromJSON = linesData[lineKey];
    return {
        nombre: `Línea ${lineKey.replace('l', '')}`,
        key: lineKey,
        data: {
            Estreno: lineInfo.Estreno || lineDataFromJSON?.Estreno || 'No disponible',
            Longitud: lineInfo.Longitud || lineDataFromJSON?.Longitud || 'No disponible',
            'N° estaciones': lineInfo.estaciones?.length || lineDataFromJSON?.['N° estaciones'] || 0,
            Comunas: lineInfo.Comunas || lineDataFromJSON?.Comunas || ['No disponible'],
            Electrificación: lineInfo.Electrificación || lineDataFromJSON?.Electrificación || 'No disponible',
            Flota: lineInfo.Flota || lineDataFromJSON?.Flota || ['No disponible'],
            Características: lineInfo.Características || lineDataFromJSON?.Características || 'No disponible'
        },
        mensaje: lineInfo.mensaje || '',
        mensaje_app: lineInfo.mensaje_app || 'No disponible',
        color: '#5865F2' // Default color
    };
}

module.exports = {
    hasExpressRoute,
    getLineData
};
