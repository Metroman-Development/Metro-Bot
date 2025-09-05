const BaseSearch = require('./BaseSearch');

module.exports = class ExactSearch extends BaseSearch {
  execute(query, data, options = {}) {
    const normalizedQuery = options.normalize(query);
    return data.filter(item => {
      // Check both displayName and aliases
      const itemNames = [item.displayName, ...(item.aliases || [])];
      return itemNames.some(name => 
        options.normalize(name) === normalizedQuery
      );
    }).map(item => ({
      ...item,
      score: 1.0,
      matchType: 'exact'
    }));
  }
};