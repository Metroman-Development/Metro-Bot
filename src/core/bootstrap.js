const logger = require('../events/logger');
const { MetroInfoProvider } = require('../utils/MetroInfoProvider');
const DatabaseManager = require('./database/DatabaseManager');
const StatusEmbedManager = require('./status/StatusEmbedManager');
const { getDbHost } = require('../utils/env');

let initializationPromise = null;
let metroInfoProviderInstance = null;
let dbManagerInstance = null;

async function performInitialization(source = 'unknown') {
    logger.info(`[${source}] Initializing...`);

    const dbHost = '127.0.0.1';
    console.log(`DB_HOST from bootstrap: ${dbHost}`);

    const dbConfig = {
        host: dbHost,
        user: process.env.DB_USER || 'metroapi',
        password: process.env.DB_PASSWORD || 'Metro256',
        database: process.env.METRODB_NAME || 'MetroDB',
        port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : undefined,
    };

    console.log('dbConfig', dbConfig);
    try {
        dbManagerInstance = await DatabaseManager.getInstance(dbConfig);
    } catch (error) {
        console.error('Error getting DB manager instance', error);
    }


    try {
        const DatabaseService = require('./database/DatabaseService');
        const dbService = await DatabaseService.getInstance(dbManagerInstance);
        const statusEmbedManager = new StatusEmbedManager();
        metroInfoProviderInstance = MetroInfoProvider.initialize(dbService, statusEmbedManager);
        await metroInfoProviderInstance.updateFromDb();
    } catch (error) {
        logger.error('[BOOTSTRAP] A critical error occurred during MetroInfoProvider initialization:', { error });
        process.exit(1);
    }

    logger.info(`[${source}] MetroInfoProvider and DatabaseManager initialized.`);
    return { metroInfoProvider: metroInfoProviderInstance, databaseManager: dbManagerInstance };
}

function initialize(source = 'unknown') {
    if (!initializationPromise) {
        initializationPromise = performInitialization(source);
    }
    return initializationPromise;
}

module.exports = {
    initialize,
    get metroInfoProvider() {
        return metroInfoProviderInstance;
    },
    get databaseManager() {
        return dbManagerInstance;
    }
};
