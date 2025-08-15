require('dotenv').config();
const logger = require('../events/logger');
const DatabaseManager = require('./database/DatabaseManager');
const MetroCore = require('./metro/core/MetroCore');

async function initialize(componentName) {
    logger.info(`[${componentName}] Initializing...`);

    const dbConfig = {
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.METRODB_NAME,
    };

    try {
        await DatabaseManager.getInstance(dbConfig);
        logger.info(`[${componentName}] Database connection established.`);
    } catch (error) {
        logger.error(`[${componentName}] ❌ Failed to connect to the database:`, { error });
        process.exit(1);
    }

    let metroCore;
    try {
        metroCore = await MetroCore.getInstance();
        logger.info(`[${componentName}] MetroCore initialized.`);
    } catch (error) {
        logger.error(`[${componentName}] ❌ Failed to initialize MetroCore:`, { error });
        process.exit(1);
    }

    return { metroCore };
}

module.exports = initialize;
