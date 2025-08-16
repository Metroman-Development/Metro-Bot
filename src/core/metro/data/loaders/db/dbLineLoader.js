// src/core/metro/data/loaders/db/dbLineLoader.js
const DatabaseManager = require('../../../../database/DatabaseManager');

class DbLineLoader {
    constructor() {
        this.source = 'database';
    }

    async load() {
        try {
            const db = await DatabaseManager.getInstance();
            const lines = await db.query('SELECT * FROM metro_lines');

            const lineData = {};
            for (const line of lines) {
                lineData[line.line_id.toLowerCase()] = {
                    nombre: line.line_name,
                    color: line.line_color,
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
