const metroConfig = require('../../../../config/metro/metroConfig');

const chileanLines = {
  '1': 'l1', '2': 'l2', '3': 'l3', '4': 'l4', 
  '4a': 'l4a', '5': 'l5', '6': 'l6'
};

module.exports = {
  normalizeKey: function(input) {
    if (!input) return 'l1';
    const num = module.exports.extractLineNumber(input);
    
    return chileanLines[num] || 'l1';
  },

  formatDisplay: function(line) {
    // Use module.exports.normalizeKey to ensure proper context
    const key = module.exports.normalizeKey(line);
    return `Línea ${key.replace('l', '').toUpperCase()}`;
  }, 
    
  getLineEmoji: function(lineKey) {
    return metroConfig.linesEmojis[lineKey.toLowerCase()] || '';
  }, 
    
  extractLineNumber: function(input) { 
    console.log(input);
    const match = input.match(/l(\d+[a-z]*)/i);
    return match ? match[1].toLowerCase() : '1'; 
  }
};