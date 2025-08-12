/**
 * @module stationDataUtils
 * @description Provides a utility for fetching comprehensive, unified data for a specific station.
 */

const path = require('path');
const loadJsonFile = require('./jsonLoader');

// Load all data sources
const stationsData = loadJsonFile(path.join(__dirname, 'stationsData.json'));
const lineData = {
    l1: loadJsonFile(path.join(__dirname, './lineData/l1.json')), // Example line data
    // Add other lines similarly
};

/**
 * Retrieves and combines data from multiple sources for a single station.
 * @param {string} stationName - The name of the station.
 * @param {string} line - The line identifier (e.g., 'l1').
 * @returns {object} A unified object containing the station's details.
 */
function getFullStationData(stationName, line) {
    const normalizedKey = `${stationName.toLowerCase()} ${line.toLowerCase()}`;
    const lineKey = line.toLowerCase();

    // Get basic info from line data
    const lineStation = lineData[lineKey]?.estaciones.find(s =>
        s.nombre.toLowerCase() === `${stationName.toLowerCase()} ${lineKey.toUpperCase()}`
    );

    // Get additional data from stationsData.json
    const additionalData = stationsData.stationsData[normalizedKey] || [];
    const schematics = stationsData.stationsSchematics[normalizedKey] || [];

    return {
        basicInfo: {
            name: lineStation?.nombre || stationName,
            code: lineStation?.codigo || '',
            status: lineStation?.estado || '1',
            combinacion: lineStation?.combinacion || '',
            description: lineStation?.descripcion || additionalData[4] || 'No description available',
        },
        services: additionalData[1]?.split(', ') || [],
        accessibility: additionalData[2] || 'No accessibility information',
        amenities: additionalData[3]?.split(', ') || [],
        schematics: {
            image: schematics[0] || '',
            pdf: schematics[1] || ''
        },
        municipality: additionalData[6] || 'Unknown'
    };
}

module.exports = { getFullStationData };
