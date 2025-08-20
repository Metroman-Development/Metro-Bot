const DatabaseManager = require('./src/core/database/DatabaseManager');
const dbLineLoader = require('./src/core/metro/data/loaders/db/dbLineLoader');
const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.METRODB_NAME,
    port: process.env.DB_PORT || 3306
};

async function testLoader() {
    let dbManager;
    try {
        console.log('Initializing DatabaseManager...');
        dbManager = await DatabaseManager.getInstance(dbConfig);
        console.log('DatabaseManager initialized.');

        console.log('Loading line data...');
        const lineData = await dbLineLoader.load(dbManager);
        console.log('Line data loaded:');
        console.log(JSON.stringify(lineData, null, 2));

    } catch (error) {
        console.error('An error occurred during the test:', error);
    } finally {
        if (dbManager) {
            console.log('Closing database connection...');
            await dbManager.close();
            console.log('Database connection closed.');
        }
    }
}

testLoader();
