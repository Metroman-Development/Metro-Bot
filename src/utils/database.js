const mysql = require('mysql2');
const logger = require('../events/logger');

// Create the connection pool
const pool = mysql.createPool({
    host: 'mysql.db.bot-hosting.net',
    port: 3306,
    user: 'u336679_8hD1wqZJjU',
    password: 'Swr6mp8mjYgXs.uJ5^^8Z5VO',
    database: 's336679_metromegabase',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Get the promise-based interface
const db = pool.promise();

// Add inspection methods directly to the pool
db.inspectTable = async (tableName) => {
    try {
        const [results] = await db.query(`
            SELECT
                COLUMN_NAME as columnName,
                DATA_TYPE as type,
                COLUMN_TYPE as fullType,
                IS_NULLABLE as nullable,
                COLUMN_DEFAULT as defaultValue,
                COLUMN_KEY as key,
                EXTRA as extra
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = ?
            AND TABLE_NAME = ?
            ORDER BY ORDINAL_POSITION
        `, [pool.config.connectionConfig.database, tableName]);
        return results;
    } catch (error) {
        logger.error(`Table inspection failed: ${error.message}`);
        throw error;
    }
};

db.sampleData = async (tableName, limit = 5) => {
    try {
        const [rows] = await db.query(
            `SELECT * FROM ?? LIMIT ?`,
            [tableName, limit]
        );
        return rows;
    } catch (error) {
        logger.error(`Data sampling failed: ${error.message}`);
        throw error;
    }
};

db.listTables = async () => {
    try {
        const [tables] = await db.query(`
            SELECT
                TABLE_NAME as tableName,
                TABLE_ROWS as rowCount,
                DATA_LENGTH as dataSize,
                CREATE_TIME as created
            FROM INFORMATION_SCHEMA.TABLES
            WHERE TABLE_SCHEMA = ?
        `, [pool.config.connectionConfig.database]);
        return tables;
    } catch (error) {
        logger.error(`Table listing failed: ${error.message}`);
        throw error;
    }
};

// Export the enhanced pool directly
module.exports = db;
