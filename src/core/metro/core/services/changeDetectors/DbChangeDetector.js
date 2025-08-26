// src/core/metro/core/services/changeDetectors/DbChangeDetector.js

class DbChangeDetector {
    constructor(databaseService) {
        this.databaseService = databaseService;
    }

    async getLatestChangeTimestamp() {
        const latestChange = await this.databaseService.getLatestChange();
        if (latestChange) {
            return new Date(latestChange.changed_at);
        }
        return null;
    }
}

module.exports = DbChangeDetector;
