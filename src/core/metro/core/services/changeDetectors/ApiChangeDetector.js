// src/core/metro/core/services/changeDetectors/ApiChangeDetector.js

class ApiChangeDetector {
    constructor(apiService) {
        this.apiService = apiService;
    }

    async getLatestChangeTimestamp() {
        return new Date(this.apiService.metrics.lastSuccess);
    }
}

module.exports = ApiChangeDetector;
