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

    const transferLine = matchedStation.transfer
        ? `l${matchedStation.transfer.replace('l', '')}`
        : null;

    if (!transferLine) {
        console.error(`❌ No transfer found for station: ${matchedStation.original}`);
        return null;
    }

    const transferStation = metroData[transferLine]?.stations
        .find(station => sharedNormalize(station.name.toLowerCase()) === sharedNormalize(matchedStation.original.toLowerCase()));

    if (!transferStation) {
        console.error(`❌ No transfer station found for: ${matchedStation.original}`);
        return null;
    }

    return transferStation.transfer || null;
}

module.exports = { fetchCombinacion };