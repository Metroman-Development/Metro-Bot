// modules/metro/utils/stringHandlers/validators.js
const { normalize } = require('./normalization');
const { normalizeKey } = require('./lineProcessing');
const metroConfig = require('../../../../config/metro/metroConfig');

// New implementation
function isValidStation(name) {
    if (!name) return false;
    const normalized = normalize(name);
    return normalized.length >= 3 && /[a-z]/.test(normalized);
}

// Legacy implementation
function isTransfer(station) {
    console.warn('DEPRECATED: Use isTransferStation instead');
    return (station.connections?.length > 0) || 
           (station.combination?.length > 0);
}

// Modern implementation
function isTransferStation(station) {
    return (station.transferLines?.length > 0) || 
           (station.connections?.length > 0) ||
           (!!station.combination);
}

// Export both patterns
module.exports = {
    // Legacy exports
    isValidStation,
    isTransfer,
    
    // Modern exports
    isTransferStation,
    isValidLine: (lineCode) => Object.keys(metroConfig.linesEmojis).includes(normalizeKey(lineCode))
};
