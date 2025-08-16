// src/core/metro/data/loaders/db/dbLineLoader.js
const DatabaseManager = require('../../../../database/DatabaseManager');

class DbLineLoader {
    constructor() {
        this.source = 'database';
    }

    async load(dbManager) {
        try {
            if (!dbManager) throw new Error('DatabaseManager is not provided to dbLineLoader');
            const lines = await dbManager.query('SELECT * FROM metro_lines');

            const lineData = {};
            for (const line of lines) {
                const lineId = line.line_id.toLowerCase();
                lineData[lineId] = {
                    id: lineId,
                    displayName: line.line_name,
                    color: line.line_color,
                    status: {
                        message: line.status_message,
                        code: line.status_code
                    },
                    // Add other properties as needed from the metro_lines table
                };
            }

            return lineData;
        } catch (error) {
            console.error('Error loading line data from database:', error);
            throw error;
        }
    }
}

module.exports = new DbLineLoader();
