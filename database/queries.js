const db = require('./db');
const logger = require('../events/logger');

module.exports = {
    getSchemaInfo: async () => {
        try {
            const [rows] = await db.query(`
                SELECT 
                    TABLE_NAME as table_name,
                    COLUMN_NAME as column_name, 
                    DATA_TYPE as data_type
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = ?
                ORDER BY TABLE_NAME, ORDINAL_POSITION
            `, [db.config.connectionConfig.database]);
            return rows;
        } catch (error) {
            logger.error(`Database schema query failed: ${error.message}`);
            throw error;
        }
    },

    getLatestMetroData: async () => {
        try {
            const [rows] = await db.query(`
                SELECT data FROM metro_data_history 
                WHERE state_type = 'normal'
                ORDER BY timestamp DESC 
                LIMIT 1
            `);
            return rows.length ? rows[0].data : null;
        } catch (error) {
            logger.error(`Data retrieval failed: ${error.message}`);
            throw error;
        }
    },

    insertMetroData: async (data) => {
        try {
            await db.query(
                'INSERT INTO metro_data_history (data, state_type) VALUES (?, ?)',
                [JSON.stringify(data), 'normal']
            );
            return true;
        } catch (error) {
            logger.error(`Data insertion failed: ${error.message}`);
            throw error;
        }
    }
};