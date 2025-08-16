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

    let metroCore;
    try {
        // Pass dbConfig to MetroCore, which will in turn initialize DatabaseManager
        metroCore = await MetroCore.getInstance({ dbConfig });
        logger.info(`[${componentName}] MetroCore and DatabaseManager initialized.`);
    } catch (error) {
        logger.error(`[${componentName}] ❌ Failed to initialize MetroCore or Database:`, { error });
        process.exit(1);
    }

    return { metroCore };
}

module.exports = initialize;
