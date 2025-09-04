const { diff } = require('deep-diff');

class DbChangeDetector {
    constructor(databaseService) {
        this.databaseService = databaseService;
    }


    async fetchData() {
        return this.databaseService.getAllData();
    }

    detectChanges(oldData, newData) {
        return diff(oldData, newData);
    }
}

module.exports = DbChangeDetector;
