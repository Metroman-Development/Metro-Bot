const fs = require('fs');
const path = require('path');

// Load all data sources
const stationsData = JSON.parse(fs.readFileSync(path.join(__dirname, 'stationsData.json'), 'utf-8'));
const lineData = {
    l1: require('./lineData/l1.json'), // Example line data
    // Add other lines similarly
};

// 🚀 Unified station data fetcher
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