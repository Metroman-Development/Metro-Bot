const { diff } = require('deep-diff');
const fs = require('fs').promises;
const path = require('path');

class ApiChangeDetector {
    constructor(apiService) {
        this.apiService = apiService;
        this.apiChangesFilePath = path.join(__dirname, '../../../../../data/apiChanges.json');
    }


    async fetchData() {
        return this.apiService.getCurrentData();
    }

    detectChanges(oldData, newData) {
        return diff(oldData, newData);
    }
}

module.exports = ApiChangeDetector;
