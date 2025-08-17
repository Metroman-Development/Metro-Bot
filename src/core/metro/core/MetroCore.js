const EventEmitter = require('events');
const path = require('path');
const { performance } = require('perf_hooks');
const logger = require('../../../events/logger');
const EventRegistry = require('../../../core/EventRegistry');
const EventPayload = require('../../../core/EventPayload');
const DataEngine = require('./internal/DataEngine');
const EventEngine = require('./internal/EventEngine');
const StatusEngine = require('./internal/StatusEngine');
const ScheduleEngine = require('./internal/ScheduleEngine');

const DataLoader = require('./DataLoader');
const ApiService = require('./services/ApiService');
const StatusOverrideService = require('./services/StatusOverrideService');
const SchedulerService = require('../../chronos/SchedulerService');
const TimeService = require('./services/TimeService');
const AccessibilityService = require('./services/AccessibilityService');
const stringUtils = require('../utils/stringHandlers');
const StatusProcessor = require('../../status/utils/StatusProcessor');
const ChangeAnnouncer = require('../../status/ChangeAnnouncer');
const OverrideManager = require('./services/OverrideManager');

/**
 * @class MetroCore
 * @extends EventEmitter
 * @description The central class for managing all metro-related data, events, and services.
 * It follows a singleton pattern to ensure only one instance is active.
 */
class MetroCore extends EventEmitter {
    static #instance = null;
    static #initializationPromise = null;

    /**
     * @constructor
     * @param {object} options - Configuration options for the MetroCore instance.
     * @param {import('discord.js').Client} options.client - The Discord client instance.
     * @param {boolean} options.debug - Whether to enable debug mode.
     */
    constructor(options = {}) {
        if (MetroCore.#instance) {
            return MetroCore.#instance;
        }

        super();
        MetroCore.#instance = this;

        if (!options.client) {
            logger.warn("A Discord client instance is required for full functionality.");
        }
        
        this._debug = options.debug || false;
        this.isReady = false;
        this.client = options.client;
        this.config = require('../../../config/metro/metroConfig');
        if (options.dbConfig) {
            this.config.database = options.dbConfig;
        }
        this.styles = {};
        
        this._initDataStores();
        this._initEngines();
    }

    /**
     * @private
     * Initializes all subsystems, such as utilities, managers, and data loaders.
     */
    _initSubsystems() {
        this._subsystems = this._subsystems || {};

        this._subsystems.utils = {
            string: stringUtils,
            config: this.config,
            time: require('../../chronos/timeHelpers'),
            getSafe: (obj, path, def = null) => {
                try {
                    return path.split('.').reduce((o, p) => o && o[p], obj) || def;
                } catch (e) {
                    return def;
                }
            }
        };

        try {
            this._subsystems.managers = {
                stations: new (require('./managers/StationManager'))({}, this._subsystems.utils),
                lines: new (require('./managers/LineManager'))({}, this._subsystems.utils)
            };
        } catch (managerError) {
            logger.error('[MetroCore] Manager initialization failed:', { managerError });
            throw new Error(`Failed to initialize managers: ${managerError.message}`);
        }

        this._subsystems.dataLoader = new DataLoader({ dbManager: this.dbManager });
        this._subsystems.scheduleHelpers = require('../../chronos/utils/scheduleHelpers');
        this._subsystems.statusProcessor = new StatusProcessor(this, this.dbManager);
        this._subsystems.changeAnnouncer = new ChangeAnnouncer();
        this._subsystems.metroInfoProvider = require('../../../utils/MetroInfoProvider');

        if (this._debug) {
            logger.debug('[MetroCore] Subsystems initialized:', {
                utils: Object.keys(this._subsystems.utils),
                managers: Object.keys(this._subsystems.managers),
                other: Object.keys(this._subsystems).filter(k => !['utils', 'managers'].includes(k))
            });
        }
    }

    /**
     * @private
     * Initializes the data stores for static, dynamic, and combined data.
     */
    _initDataStores() {
        this._staticData = {};
        this._dynamicData = {};
        this._combinedData = {
            version: '0.0.0',
            lastUpdated: new Date(0),
            lines: {},
            stations: {},
            network: { status: 'initializing' }
        };
        this._dataVersion = '0.0.0';
    }

    /**
     * @private
     * Initializes the internal engines for data, events, status, and scheduling.
     */
    _initEngines() {
        this._engines = {
            data: new DataEngine(this),
            events: new EventEngine(this),
            status: new StatusEngine(this),
            schedule: new ScheduleEngine(this)
        };

        this._bindEngineMethods();
    }

    /**
     * @private
     * Binds methods from the internal engines to the MetroCore instance.
     */
    _bindEngineMethods() {
        this._safeEmit = this._engines.events.safeEmit.bind(this._engines.events);
        this._combineData = this._engines.data.combine.bind(this._engines.data);
        this._emitError = this._engines.events.emitError.bind(this._engines.events);
        this._handleRawData = this._engines.data.handleRawData.bind(this._engines.data);
        this._enterSafeMode = this._engines.status.enterSafeMode.bind(this._engines.status);
        this._setupEventListeners = this._engines.events.setupListeners.bind(this._engines.events);
        this._removeAllListeners = this._engines.events.removeAllListeners.bind(this._engines.events);
    }

    /**
     * Retrieves the singleton instance of MetroCore, initializing it if necessary.
     * @param {object} options - Configuration options for the MetroCore instance.
     * @returns {Promise<MetroCore>} The singleton instance.
     */
    static async getInstance(options = {}) {
        if (this.#instance) return this.#instance;
        if (this.#initializationPromise) return this.#initializationPromise;

        this.#initializationPromise = (async () => {
            try {
                const instance = new MetroCore(options);

                // Dynamically select the database manager based on the process type
                let dbManager;
                if (process.env.IS_WORKER_PROCESS === 'true') {
                    const DatabaseManagerProxy = require('../../../core/database/DatabaseManagerProxy');
                    dbManager = DatabaseManagerProxy.getInstance();
                    logger.info('[MetroCore] Using DatabaseManagerProxy for worker process.');
                } else {
                    const DatabaseManager = require('../../../core/database/DatabaseManager');
                    dbManager = await DatabaseManager.getInstance(instance.config.database);
                    logger.info('[MetroCore] Using real DatabaseManager for master process.');
                }
                instance.dbManager = dbManager;

                // Re-initialize subsystems that depend on the database.
                instance._initSubsystems();
                await instance.initialize();
                return instance;
            } catch (error) {
                logger.error('[MetroCore] Failed to initialize database manager:', { error: error.message });
                // Re-throw the error to be caught by the caller
                throw new Error(`MetroCore initialization failed: ${error.message}`);
            }
        })();

        return this.#initializationPromise;
    }

    /**
     * Initializes the MetroCore instance by setting up all subsystems and fetching initial data.
     * @returns {Promise<void>}
     */
    async initialize() {
        try {
            logger.debug('[MetroCore] Starting initialization...');

            // Phase 1: Initialize core services
            const dbManager = this.dbManager;
            const DatabaseService = require('../../../core/database/DatabaseService');
            this._subsystems.dbService = await DatabaseService.getInstance(dbManager);
            const databaseService = this._subsystems.dbService; // for local use
            this._subsystems.statusOverrideService = new StatusOverrideService(databaseService);
            this._subsystems.overrideManager = new OverrideManager(this, dbManager);
            const cacheDir = path.join(__dirname, '../../../../data');
            this._subsystems.changeDetector = new (require('./services/ChangeDetector'))(this, { dbService: databaseService, cacheDir: cacheDir });
            this._subsystems.statusService = new (require('../../status/StatusService'))(this);
            this._subsystems.accessibilityService = new AccessibilityService({ timeHelpers: this._subsystems.utils.time, config: this.config }, databaseService);
            await this._subsystems.accessibilityService.initialize();

            // Phase 2: Initialize the API service
            this._subsystems.api = new ApiService(this, {
                statusProcessor: this._subsystems.statusProcessor,
                changeDetector: this._subsystems.changeDetector,
                dbService: databaseService,
            });
            
            // Phase 3: Set up the public API
            this.api = {
                changes: this._subsystems.api.api.changes,
                metrics: this._subsystems.api.api.metrics,
                getCacheState: this._subsystems.api.api.getCacheState,
                getProcessedData: () => this._subsystems.api.api.getProcessedData(),
                status: this.getSystemStatus.bind(this)
            };
            
            // Phase 4: Set up event listeners
            this._setupEventListeners();
            
            // Phase 5: Load static data
            this._staticData = await this._subsystems.dataLoader.load();
            this._dataVersion = this._staticData.version || `1.0.0-${Date.now()}`;
            
            // Phase 6: Initialize data managers
            await this._subsystems.managers.stations.updateData(
                this._staticData.stations || {}
            );
            await this._subsystems.managers.lines.updateData(
                this._staticData.lines || {}
            );
            
            // Phase 7: Fetch initial network status
            await this._subsystems.api.fetchNetworkStatus();

            logger.debug('[MetroCore] Initialization complete.');
            
            this._safeEmit(EventRegistry.SYSTEM_READY, { 
                version: '1.0.0',
                startupTime: Date.now()
            }, { source: 'MetroCore' });

            this.isReady = true;
            this.emit('ready');
            // Phase 9: Initialize the status updater is now handled by setClient
        } catch (error) {
            logger.error('[MetroCore] A critical error occurred during initialization:', { error });
            this._emitError('initialize', error);
        }
    }

    /**
     * Retrieves the current status of the entire metro system.
     * @returns {object} An object containing the system status.
     */
    getSystemStatus() {
        return {
            version: this._dataVersion,
            status: this._combinedData.network,
            lastUpdated: this._combinedData.lastUpdated,
            lines: {
                total: Object.keys(this._combinedData.lines).length,
                operational: Object.values(this._combinedData.lines)
                    .filter(line => line.status.code === '1').length
            },
            stations: {
                total: Object.keys(this._combinedData.stations).length,
                operational: Object.values(this._combinedData.stations)
                    .filter(station => station.status.code === '1').length
            },
            changes: this.api.changes.history().stats
        };
    }


    /**
     * Sends a full status report to the designated channel.
     */
    sendFullStatusReport() {
        return this._engines.status.sendFullReport();
    }

    sendSystemStatusReport() {
        logger.info('[MetroCore] Sending system status report...');
        return this.sendFullStatusReport();
    }

    /**
     * Performs a health check of the system.
     * @returns {object} An object containing health check results.
     */
    healthCheck() {
        return this._engines.status.healthCheck();
    }

    /**
     * Retrieves the station manager.
     * @returns {import('./managers/StationManager')} The station manager instance.
     */
    getStationManager() {
        return this._subsystems.managers.stations;
    }

    /**
     * Retrieves the line manager.
     * @returns {import('./managers/LineManager')} The line manager instance.
     */
    getLineManager() {
        return this._subsystems.managers.lines;
    }

    async _initializeSchedulingSystem() {
        if (!this._engines.schedule) {
            logger.warn('[MetroCore] Schedule engine not found.');
            return;
        }
        try {
            await this._engines.schedule.initialize();
            logger.info('[MetroCore] Scheduling system initialized.');
        } catch (error) {
            logger.error('[MetroCore] Failed to initialize scheduling system:', { error });
            this._emitError('initializeSchedulingSystem', error);
        }
    }

    async setClient(client) {
        if (!this.isReady) {
            logger.warn('[MetroCore] setClient called before instance is ready. Waiting...');
            await new Promise(resolve => this.once('ready', resolve));
            logger.info('[MetroCore] Instance is now ready. Proceeding with setClient.');
        }
        this.client = client;
        if (this.client) {
            logger.info('[MetroCore] Discord client set. Initializing client-dependent subsystems.');
            this._subsystems.timeService = new TimeService(this);
            await this._initializeSchedulingSystem();
            this._subsystems.statusUpdater = new (require('../../status/embeds/StatusUpdater'))(this, this._subsystems.changeDetector);
            await this._subsystems.statusUpdater.initialize();
            this._subsystems.statusUpdater.triggerInitialUpdate();
        }
    }

    /**
     * Retrieves the current processed data.
     * @returns {object} The processed metro data.
     */
    getCurrentData() {
        return this.api.getProcessedData();
    }

    /**
     * Cleans up resources used by the MetroCore instance.
     */
    cleanup() {
        if (this._subsystems.api) {
            this._subsystems.api.cleanup();
        }
        this._removeAllListeners();
    }

    /**
     * Refreshes static data from source files and and updates all dependent subsystems.
     * @returns {Promise<void>} Resolves when the refresh is complete, or rejects on error.
     */
    async refreshStaticData() {
        if (!this._subsystems?.dataLoader) {
            throw new Error('Cannot refresh data: DataLoader subsystem is not initialized.');
        }

        try {
            logger.debug('[MetroCore] Refreshing static data...');

            const newStaticData = await this._subsystems.dataLoader.load();

            if (!newStaticData || typeof newStaticData !== 'object') {
                throw new Error('Loaded data is invalid or empty.');
            }

            this._staticData = newStaticData;
            this._dataVersion = newStaticData.version || `1.0.0-${Date.now()}`;
            this._combinedData.lastUpdated = new Date();

            await Promise.all([
                this._subsystems.managers.stations.updateData(
                    newStaticData.stations || {}
                ),
                this._subsystems.managers.lines.updateData(
                    newStaticData.lines || {}
                )
            ]);

            await this._combineData();

            logger.debug('[MetroCore] Static data refresh completed.');

        } catch (error) {
            logger.error('[MetroCore] Static data refresh failed:', error);
            this._emitError('refreshStaticData', error);

            if (error.message.includes('invalid') || !this._staticData) {
                await this._enterSafeMode();
            }
            throw error;
        }
    }
}

module.exports = MetroCore;
