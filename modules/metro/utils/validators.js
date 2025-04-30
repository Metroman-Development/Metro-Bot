const { lines, stations } = require('../queries');
const { normalizeKey, validLines } = require('./lineProcessing');
const { normalize } = require('./normalization');

module.exports = {
  /**
   * Validates a line ID against system standards
   * @param {string} lineId - Line identifier (e.g., 'l1', '5')
   * @param {object} options - { required: boolean, allowLegacy: boolean }
   * @returns {ValidationResult}
   */
  validateLine: function(lineId, options = {}) {
    const result = { isValid: false, normalized: null, reason: '' };
    if (!lineId && !options.required) {
      return { ...result, isValid: true };
    }

    const normalized = normalizeKey(lineId);
    result.normalized = normalized;

    if (!validLines.has(normalized.replace('l', ''))) {
      return { ...result, reason: 'INVALID_LINE' };
    }

    if (options.allowLegacy === false && normalized === 'l0') {
      return { ...result, reason: 'LEGACY_LINE_NOT_ALLOWED' };
    }

    return { ...result, isValid: true };
  },

  /**
   * Validates station existence and properties
   * @param {string} stationIdentifier - Name or ID
   * @param {string} lineId - Optional line context
   * @returns {ValidationResult}
   */
  validateStation: async function(stationIdentifier, lineId) {
    const result = { isValid: false, station: null, reason: '' };
    
    try {
      const station = await stations.getStation(
        normalize(stationIdentifier), 
        lineId ? normalizeKey(lineId) : null
      );
      
      if (!station) {
        return { ...result, reason: 'STATION_NOT_FOUND' };
      }

      if (station.status !== 'active') {
        return { ...result, station, reason: 'STATION_INACTIVE' };
      }

      return { ...result, isValid: true, station };
    } catch (error) {
      return { ...result, reason: 'VALIDATION_ERROR' };
    }
  },

  /**
   * Validates route combinations
   * @param {Array<string>} routeTypes - ['comun', 'verde', 'roja']
   * @returns {ValidationResult}
   */
  validateRouteCombination: function(routeTypes) {
    const validTypes = new Set(['comun', 'verde', 'roja']);
    const invalid = routeTypes.filter(t => !validTypes.has(t));
    
    return {
      isValid: invalid.length === 0,
      reason: invalid.length ? `INVALID_ROUTE_TYPES: ${invalid.join(',')}` : '',
      allowedTypes: Array.from(validTypes)
    };
  }
};