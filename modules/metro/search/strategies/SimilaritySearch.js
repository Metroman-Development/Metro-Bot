const Metaphone = require('./utils/Metaphone');
const stringSimilarity = require('string-similarity');	

module.exports = class SimilaritySearch {
  constructor(options = {}) {
    this.threshold = options.threshold || 0.6;
    this.phoneticWeight = options.phoneticWeight || 0.4;
  }

  execute(query, data, options) {
    const queryNormalized = options.normalize(query);
    const { primary, alternate } = Metaphone.process(queryNormalized);

    return data.map(item => {
      // Use displayName as primary match target
      const normalizedName = options.normalize(item.displayName);
      const textScore = stringSimilarity.compareTwoStrings(
        queryNormalized,
        normalizedName
      );
      
      // Simple phonetic matching (could be enhanced)
      const namePhonetic = Metaphone.process(normalizedName);
      const pMatch = namePhonetic.primary === primary ? 1 : 0;
      const aMatch = namePhonetic.alternate === alternate ? 1 : 0;
      const phoneticScore = (pMatch + aMatch) / 2;

      return {
        ...item,
        score: (textScore * (1 - this.phoneticWeight)) + 
               (phoneticScore * this.phoneticWeight),
        matchType: 'similar'
      };
    }).filter(item => item.score >= this.threshold)
      .sort((a, b) => b.score - a.score);
  }
};
 