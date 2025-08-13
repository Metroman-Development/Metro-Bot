// modules/metro/utils/stringHandlers/index.js
const normalization = require('./normalization');
const formatting = require('./stationFormatting');
const lineUtils = require('./lineProcessing');
const validators = require('./validators');
const decorators = require('./decorators');

// Maintain the exact same export structure
const stringUtils = {
  // Core functions (unchanged)
  normalize: normalization.normalize,
  normalizeForSearch: normalization.normalizeForSearch,
  formatName: formatting.formatName,
  formatDisplay: lineUtils.formatDisplay,
  validateStation: validators.isValidStation,
  
  // Namespaces (unchanged)
  station: formatting,
  line: lineUtils,
  
  // Add decorators while preserving existing getLineEmoji
  getLineEmoji: lineUtils.getLineEmoji,
  decorateStation: decorators.decorateStation,
  decorateLine: decorators.decorateLine
};

module.exports = stringUtils;

    