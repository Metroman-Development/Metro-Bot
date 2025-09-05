const logger = require('../events/logger');
const { MetroInfoProvider } = require('../utils/MetroInfoProvider');
const DatabaseManager = require('./database/DatabaseManager');
const { getDbHost } = require('../utils/env');

let initializationPromise = null;
let metroInfoProviderInstance = null;
let dbManagerInstance = null;
let dataManagerInstance = null;
let statusServiceInstance = null;
let changeDetectorInstance = null;
let statusUpdaterInstance = null;
let updateListenerInstance = null;
let timeServiceInstance = null;
let accessibilityServiceInstance = null;
let stationManagerInstance = null;
let lineManagerInstance = null;
let changeAnnouncerInstance = null;
let statusEmbedManagerInstance = null;
let schedulerServiceInstance = null;

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
        const metroConfig = require('../config/metro/metroConfig');
        const statusTypes = await dbManagerInstance.query('SELECT status_type_id, status_name, emoji FROM operational_status_types');
        const statusMapping = {};
        for (const type of statusTypes) {
            statusMapping[type.status_type_id] = {
                message: type.status_name,
                emoji: type.emoji
            };
        }
        metroConfig.statusMapping = statusMapping;
        logger.info('[BOOTSTRAP] Metro config initialized successfully.');
    } catch (error) {
        logger.error('[BOOTSTRAP] Failed to initialize Metro config from DB:', error);
        console.error('Error getting DB manager instance', error);
    }


    try {
        const DatabaseService = require('./database/DatabaseService');
        const dbService = await DatabaseService.getInstance(dbManagerInstance);
        const StatusEmbedManager = require('./status/StatusEmbedManager');
        statusEmbedManagerInstance = new StatusEmbedManager();
        metroInfoProviderInstance = MetroInfoProvider.initialize(dbService, statusEmbedManagerInstance);
        await metroInfoProviderInstance.updateFromDb();

        const DataManager = require('./metro/core/services/DataManager');
        dataManagerInstance = new DataManager({ dbService });

        const StatusService = require('./status/StatusService');
        statusServiceInstance = new StatusService();

        const MyChangeDetector = require('./status/ChangeDetector');
        changeDetectorInstance = new MyChangeDetector(statusServiceInstance, dbService);

        const ChangeAnnouncer = require('./status/ChangeAnnouncer');
        changeAnnouncerInstance = new ChangeAnnouncer();

        const SchedulerService = require('./SchedulerService');
        schedulerServiceInstance = new SchedulerService(
            dbManagerInstance,
            dataManagerInstance,
            changeAnnouncerInstance,
            statusEmbedManagerInstance,
            metroInfoProviderInstance,
            'America/Santiago'
        );

        const StatusUpdater = require('./status/embeds/StatusUpdater');
        statusUpdaterInstance = new StatusUpdater(changeDetectorInstance, metroInfoProviderInstance, changeAnnouncerInstance);

        const UpdateListener = require('./status/embeds/UpdateListener');
        updateListenerInstance = new UpdateListener(statusUpdaterInstance);

        const TimeService = require('./metro/core/services/TimeService');
        timeServiceInstance = new TimeService();

        const AccessibilityService = require('./metro/core/services/AccessibilityService');
        const timeHelpers = require('../utils/timeHelpers');
        const metroConfig = require('../config/metro/metroConfig');
        accessibilityServiceInstance = new AccessibilityService({ timeHelpers, config: metroConfig }, dbService);

        const StationManager = require('./metro/core/managers/StationManager');
        stationManagerInstance = new StationManager();

        const LineManager = require('./metro/core/managers/LineManager');
        lineManagerInstance = new LineManager();

    } catch (error) {
        logger.error('[BOOTSTRAP] A critical error occurred during MetroInfoProvider initialization:', { error });
        process.exit(1);
    }

    logger.info(`[${source}] MetroInfoProvider and DatabaseManager initialized.`);
    return { metroInfoProvider: metroInfoProviderInstance, databaseManager: dbManagerInstance, dataManager: dataManagerInstance, statusService: statusServiceInstance, statusUpdater: statusUpdaterInstance, updateListener: updateListenerInstance, timeService: timeServiceInstance, accessibilityService: accessibilityServiceInstance, stationManager: stationManagerInstance, lineManager: lineManagerInstance, schedulerService: schedulerServiceInstance };
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
    },
    get dataManager() {
        return dataManagerInstance;
    },
    get statusService() {
        return statusServiceInstance;
    },
    get changeDetector() {
        return changeDetectorInstance;
    },
    get statusUpdater() {
        return statusUpdaterInstance;
    },
    get updateListener() {
        return updateListenerInstance;
    },
    get timeService() {
        return timeServiceInstance;
    },
    get accessibilityService() {
        return accessibilityServiceInstance;
    },
    get stationManager() {
        return stationManagerInstance;
    },
    get lineManager() {
        return lineManagerInstance;
    },
    get changeAnnouncer() {
        return changeAnnouncerInstance;
    },
    get schedulerService() {
        return schedulerServiceInstance;
    }
};
