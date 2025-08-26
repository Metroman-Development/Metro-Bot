// src/core/metro/core/services/changeDetectors/ApiChangeDetector.js

class ApiChangeDetector {
    constructor(apiService) {
        this.apiService = apiService;
    }

    async getLatestChangeTimestamp() {
        const apiData = await this.apiService.fetchData();
        return new Date(apiData.lastSuccessfulFetch);
    }
}

module.exports = ApiChangeDetector;
