class BaseSearch {
    execute(query, data, options) {
        throw new Error('Search strategies must implement an execute method.');
    }
}

module.exports = BaseSearch;
