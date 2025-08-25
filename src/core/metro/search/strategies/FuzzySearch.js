const stringSimilarity = require('string-similarity');
const natural = require('natural');
const BaseSearch = require('./BaseSearch');

const Metaphone = natural.Metaphone;

class FuzzySearch extends BaseSearch {
    constructor(options = {}) {
        super();
        this.phoneticWeight = options.phoneticWeight || 0.8;
        this.minLength = options.minLength || 3;
    }

    execute(query, data, options) {
        if (query.length < this.minLength) {
            return [];
        }

        const queryNormalized = options.normalize(query);
        const queryPhonetic = Metaphone.process(queryNormalized);

        const results = data.map(item => {
            const itemName = options.normalize(item.displayName);
            const textScore = stringSimilarity.compareTwoStrings(queryNormalized, itemName);

            const itemPhonetic = Metaphone.process(itemName);
            const phoneticScore = natural.JaroWinklerDistance(queryPhonetic, itemPhonetic);

            const isPartialMatch = itemName.includes(queryNormalized) || queryNormalized.includes(itemName);

            let score = (textScore * (1 - this.phoneticWeight)) + (phoneticScore * this.phoneticWeight);
            if (isPartialMatch) {
                score = Math.max(score, 0.8);
            }

            return {
                ...item,
                status: item.status || 'operational',
                score: score,
                matchType: 'fuzzy'
            };
        });

        return results.filter(item => item.score > 0).sort((a, b) => b.score - a.score);
    }
}

module.exports = FuzzySearch;
