const natural = require('natural');
const Metaphone = natural.Metaphone;

class SearchIndexer {
    constructor(data) {
        this.data = data;
        this.index = null;
    }

    buildIndex() {
        this.index = {};
        for (const key in this.data) {
            const dataAsArray = Array.isArray(this.data[key]) ? this.data[key] : Object.values(this.data[key]);
            this.index[key] = dataAsArray.map(item => {
                const phoneticKey = Metaphone.process(item.name);
                return {
                    ...item,
                    phoneticKey: phoneticKey
                };
            });
        }
    }

    getIndex() {
        if (!this.index) {
            this.buildIndex();
        }
        return this.index;
    }
}

module.exports = SearchIndexer;
