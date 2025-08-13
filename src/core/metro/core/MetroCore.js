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
const stringUtils = require('../utils/stringHandlers');
const StatusProcessor = require('../../status/utils/StatusProcessor');
const ChangeAnnouncer = require('../../status/ChangeAnnouncer');

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
            console.warn("A Discord client instance is required for full functionality.");
        }
        
        this._debug = options.debug || false;
        this.client = options.client;
        this.config = require('../../../config/metro/metroConfig');
        this.styles = require('../../../config/metro/styles.json');
        
        this._initSubsystems();
        this._initDataStores();
        this._initEngines();
        this._setupEventSystem();
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
            console.error('[MetroCore] Manager initialization failed:', managerError);
            throw new Error(`Failed to initialize managers: ${managerError.message}`);
        }

        this._subsystems.dataLoader = new DataLoader();
        this._subsystems.scheduleHelpers = require('../../chronos/utils/scheduleHelpers');
        this._subsystems.statusProcessor = new StatusProcessor(this);
        this._subsystems.changeAnnouncer = new ChangeAnnouncer();

        if (this._debug) {
            console.log('[MetroCore] Subsystems initialized:', {
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
        this._setupEventSystem = this._engines.events.setupSystem.bind(this._engines.events);
        this._safeEmit = this._engines.events.safeEmit.bind(this._engines.events);
        this._combineData = this._engines.data.combine.bind(this._engines.data);
        this._createStationInterface = this._engines.data.createStationInterface.bind(this._engines.data);
        this._createLineInterface = this._engines.data.createLineInterface.bind(this._engines.data);
        this._emitError = this._engines.events.emitError.bind(this._engines.events);
        this._initializeSchedulingSystem = this._engines.schedule.initialize.bind(this._engines.schedule);
        this._handleServiceTransition = this._engines.schedule.handleServiceTransition.bind(this._engines.schedule);
        this._handleExpressChange = this._engines.schedule.handleExpressChange.bind(this._engines.schedule);
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
            const instance = new MetroCore(options);
            await instance.initialize();
            return instance;
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
            this._subsystems.changeDetector = new (require('./services/ChangeDetector'))(this);
            this._subsystems.statusService = new (require('../../status/StatusService'))(this);
            
            // Phase 2: Initialize the API service
            this._subsystems.api = new ApiService(this, {
                statusProcessor: this._subsystems.statusProcessor,
                changeDetector: this._subsystems.changeDetector,
            });
            
            // Phase 3: Set up the public API
            this.api = {
                timeAwaiter: this._subsystems.api.timeAwaiter,
                changes: this._subsystems.api.api.changes,
                metrics: this._subsystems.api.api.metrics,
                getCacheState: this._subsystems.api.api.getCacheState,
                getOverridesService: () => this._subsystems.api.api.getOverridesService(),
                prepareEventOverrides: async (eventDetails) => await this._subsystems.api.api.prepareEventOverrides(eventDetails),
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
                this._createStationInterface(this._staticData.stations || {})
            );
            await this._subsystems.managers.lines.updateData(
                this._createLineInterface(this._staticData.lines || {})
            );
            
            // Phase 7: Set up the scheduling system
            await this._initializeSchedulingSystem();
            
            // Phase 8: Fetch initial network status and start polling
            await this._subsystems.api.fetchNetworkStatus();
            this._subsystems.api.startPolling();
            
            logger.debug('[MetroCore] Initialization complete.');
            
            this._safeEmit(EventRegistry.SYSTEM_READY, { 
                version: '1.0.0',
                startupTime: Date.now()
            }, { source: 'MetroCore' });

            // Phase 9: Initialize the status updater
            this._subsystems.statusUpdater = new (require('../../status/embeds/StatusUpdater'))(this, this._subsystems.changeDetector);
            await this._subsystems.statusUpdater.initialize();

        } catch (error) {
            console.error('[MetroCore] A critical error occurred during initialization:', error);
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
     * Starts polling for network status updates.
     * @param {number} interval - The polling interval in milliseconds.
     */
    startPolling(interval = 60000) {
        return this._subsystems.api.startPolling(interval);
    }

    /**
     * Stops polling for network status updates.
     */
    stopPolling() {
        return this._subsystems.api.stopPolling();
    }

    /**
     * Sends a full status report to the designated channel.
     */
    sendFullStatusReport() {
        return this._engines.status.sendFullReport();
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
     * Refreshes static data from source files and updates all dependent subsystems.
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
                    this._createStationInterface(newStaticData.stations || {})
                ),
                this._subsystems.managers.lines.updateData(
                    this._createLineInterface(newStaticData.lines || {})
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
