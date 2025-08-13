const { normalize, phonetic } = require('./normalization');
const { normalizeKey } = require('./lineProcessing');

module.exports = {
  formatName: function(name) {
    if (!name) return '';
    return name
      .replace(/estación|estación/gi, '')
      .split(/\s+/)
      .map(word => {
        if (/^(de|la|los|el|al|y)$/i.test(word)) return word.toLowerCase();
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join(' ')
      .trim();
  },

  generateId: function(name, line) {
    return `${phonetic(name)}-${normalizeKey(line)}`;
  }
};