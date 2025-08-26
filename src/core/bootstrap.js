const logger = require('../events/logger');
const MetroCore = require('./metro/core/MetroCore');
const DatabaseManager = require('./database/DatabaseManager');
const { getDbHost } = require('../utils/env');

let initializationPromise = null;
let metroCoreInstance = null;
let dbManagerInstance = null;

async function performInitialization(source = 'unknown') {
    logger.info(`[${source}] Initializing...`);

    const dbHost = getDbHost();
    console.log(`DB_HOST from bootstrap: ${dbHost}`);

    const dbConfig = {
        host: dbHost,
        user: process.env.DB_USER || 'metroapi',
        password: process.env.DB_PASSWORD || 'Metro256',
        database: process.env.DB_DATABASE || 'MetroDB',
        port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : undefined,
    };

    dbManagerInstance = await DatabaseManager.getInstance(dbConfig);

    try {
        metroCoreInstance = await MetroCore.getInstance({ dbConfig });
    } catch (error) {
        logger.error('[BOOTSTRAP] A critical error occurred during MetroCore initialization:', { error });
        process.exit(1);
    }

    logger.info(`[${source}] MetroCore and DatabaseManager initialized.`);
    return { metroCore: metroCoreInstance, databaseManager: dbManagerInstance };
}

function initialize(source = 'unknown') {
    if (!initializationPromise) {
        initializationPromise = performInitialization(source);
    }
    return initializationPromise;
}

module.exports = {
    initialize,
    get metroCore() {
        return metroCoreInstance;
    },
    get databaseManager() {
        return dbManagerInstance;
    }
};
