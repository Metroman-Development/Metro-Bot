const Metaphone = require('./utils/Metaphone');



module.exports = class PartialSearch {
  execute(query, data, options) {
    const queryNormalized = options.normalize(query);
    const { primary, alternate } = Metaphone.process(queryNormalized);

    return data.filter(item => {
      // Check displayName and aliases
      const itemNames = [item.displayName, ...(item.aliases || [])];
      return itemNames.some(name => {
        const normalizedName = options.normalize(name);
        return (
          normalizedName.includes(queryNormalized) ||
          queryNormalized.includes(normalizedName)
        );
      });
    }).map(item => ({
      ...item,
      score: 0.8,
      matchType: 'partial'
    }));
  }
};