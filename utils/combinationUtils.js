// combinationUtils.js
const { getCachedMetroData } = require('../events/metroDataHandler');
const { normalize: sharedNormalize } = require('./stringUtils');

function fetchCombinacion(matchedStation) {
    if (!matchedStation) {
        console.error('❌ No matched station provided.');
        return null;
    }

    const metroData = getCachedMetroData();
    if (!metroData) {
        console.error('❌ metroData is undefined or could not be loaded.');
        return null;
    }

    const combinacionLine = matchedStation.combinacion
        ? `l${matchedStation.combinacion.replace('l', '')}`
        : null;

    if (!combinacionLine) {
        console.error(`❌ No combinacion found for station: ${matchedStation.original}`);
        return null;
    }

    const combinacionStation = metroData[combinacionLine]?.estaciones
        .find(estacion => sharedNormalize(estacion.nombre.toLowerCase()) === sharedNormalize(matchedStation.original.toLowerCase()));

    if (!combinacionStation) {
        console.error(`❌ No combinacion station found for: ${matchedStation.original}`);
        return null;
    }

    return combinacionStation.combinacion || null;
}

module.exports = { fetchCombinacion };