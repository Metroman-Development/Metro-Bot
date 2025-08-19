require('dotenv').config();
const DatabaseManager = require('../src/core/database/DatabaseManager');

async function testDbConnection() {
    console.log('Testing DB connection...');
    try {
        const dbConfig = {
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.METRODB_NAME,
        };
        const dbManager = await DatabaseManager.getInstance(dbConfig);
        console.log('DB connection successful.');
        await dbManager.close();
    } catch (error) {
        console.error('DB connection failed:', error);
    }
}

testDbConnection();
