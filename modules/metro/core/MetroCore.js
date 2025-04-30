// modules/metro/core/MetroCore.js
// modules/metro/core/MetroCore.js
const EventEmitter = require('events');
const path = require('path');
const { performance } = require('perf_hooks');
const logger = require('../../../events/logger');
const EventRegistry = require('../../../core/EventRegistry');
const EventPayload = require('../../../core/EventPayload');

// 1. Preserve all original engine references
const DataEngine = require('./internal/DataEngine');
const EventEngine = require('./internal/EventEngine');
const StatusEngine = require('./internal/StatusEngine');
const ScheduleEngine = require('./internal/ScheduleEngine');

// 2. Keep all original module requires
const DataLoader = require('./DataLoader');
const ApiService = require('./services/ApiService');
const stringUtils = require('../utils/stringHandlers');
const StatusProcessor = require('../../status/utils/StatusProcessor');
const ChangeAnnouncer = require('../../status/ChangeAnnouncer');

class MetroCore extends EventEmitter {
    static #instance = null;
    static #initializationPromise = null;

    constructor(options = {}) {
        if (MetroCore.#instance) {
            return MetroCore.#instance;
        }

        super();
        MetroCore.#instance = this;

        if (!options.client) throw new Error("Client instance is required");
        
        // 3. Initialize properties exactly as before
        this._debug = options.debug || false;
        this.client = options.client;
        this.config = require('../../../config/metro/metroConfig');
        this.styles = require('../../../config/metro/styles.json');
        
        // 4. Initialize subsystems in original order
        this._initSubsystems();
        this._initDataStores();
        this._initEngines();
        this._setupEventSystem();
    }

    _initSubsystems() {
    // 1. Initialize the subsystems object if it doesn't exist
    this._subsystems = this._subsystems || {};

    // 2. Safely initialize utilities
    this._subsystems.utils = {
        string: stringUtils, // From '../utils/stringHandlers'
        config: this.config, // Loaded from '../../../config/metro/metroConfig'
        time: require('../../chronos/timeHelpers'),
        getSafe: (obj, path, def = null) => {
            try {
                return path.split('.').reduce((o, p) => o && o[p], obj) || def;
            } catch (e) {
                return def;
            }
        }
    };

    // 3. Initialize managers with dependency checks
    try {
        this._subsystems.managers = {
            stations: new (require('./managers/StationManager'))({}, this._subsystems.utils),
            lines: new (require('./managers/LineManager'))({}, this._subsystems.utils)
        };
    } catch (managerError) {
        console.error('[MetroCore] Manager initialization failed:', managerError);
        throw new Error(`Failed to initialize managers: ${managerError.message}`);
    }

    // 4. Initialize remaining subsystems
    this._subsystems.dataLoader = new DataLoader(); // From './DataLoader'
    this._subsystems.scheduleHelpers = require('../../chronos/utils/scheduleHelpers');
    this._subsystems.statusProcessor = new StatusProcessor(this); // From '../../status/utils/StatusProcessor'
    this._subsystems.changeAnnouncer = new ChangeAnnouncer(); // From '../../status/ChangeAnnouncer'

    // 5. Debug output if in debug mode
    if (this._debug) {
        console.log('[MetroCore] Subsystems initialized:', {
            utils: Object.keys(this._subsystems.utils),
            managers: Object.keys(this._subsystems.managers),
            other: Object.keys(this._subsystems).filter(k => !['utils', 'managers'].includes(k))
        });
    }
}

    _initDataStores() {
        // Preserve original data structures
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

    _initEngines() {
        // Original engine initialization
        this._engines = {
            data: new DataEngine(this),
            events: new EventEngine(this),
            status: new StatusEngine(this),
            schedule: new ScheduleEngine(this)
        };

        // Maintain original method bindings
        this._bindEngineMethods();
    }

    _bindEngineMethods() {
        // All original engine bindings preserved
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

    async initialize() {
        try {
            logger.debug('[MetroCore] Starting phased initialization');

            // PHASE 1: Core Subsystems - original order
            this._subsystems.changeDetector = new (require('./services/ChangeDetector'))(this);
            this._subsystems.statusService = new (require('../../status/StatusService'))(this);
            
            // PHASE 2: ApiService initialization - unchanged
            this._subsystems.api = new ApiService(this, {
                statusProcessor: this._subsystems.statusProcessor,
                changeDetector: this._subsystems.changeDetector,
            });
            
            // PHASE 3: API setup - preserving original getProcessedData reference
            this.api = {
                timeAwaiter: this._subsystems.api.timeAwaiter,
                changes: this._subsystems.api.api.changes,
                metrics: this._subsystems.api.api.metrics,
                getCacheState: this._subsystems.api.api.getCacheState,
                getOverridesService: ()=>this._subsystems.api.api.getOverridesService(),
                
                prepareEventOverrides: async (eventDetails) => await this._subsystems.api.api.prepareEventOverrides(eventDetails), 
              
                // CRITICAL: Preserving the exact original reference
                getProcessedData: () =>this._subsystems.api.api.getProcessedData(),
                status: this.getSystemStatus.bind(this)
            };
            
            // PHASE 4: Original event system setup
            this._setupEventListeners();
            
            // PHASE 5: Original data loading sequence
            this._staticData = await this._subsystems.dataLoader.load();
            this._dataVersion = this._staticData.version || `1.0.0-${Date.now()}`;
            
            // PHASE 6: Original manager initialization
            await this._subsystems.managers.stations.updateData(
                this._createStationInterface(this._staticData.stations || {})
            );
            await this._subsystems.managers.lines.updateData(
                this._createLineInterface(this._staticData.lines || {})
            );
            
            // PHASE 7: Original scheduling setup
            await this._initializeSchedulingSystem();
            
            // PHASE 8: Original API integration
       const Epic = await this._subsystems.api.fetchNetworkStatus();
            
            //console.log(this.api.getProcessedData()) 
            this._subsystems.api.startPolling();
            
            // PHASE 9: Original status system
            this._subsystems.statusUpdater = new (require('../../status/embeds/StatusUpdater'))(this, this._subsystems.changeDetector);
            await this._subsystems.statusUpdater.initialize();

            logger.debug('[MetroCore] Initialization complete');
            
            this._safeEmit(EventRegistry.SYSTEM_READY, { 
                version: '1.0.0',
                startupTime: Date.now()
            }, { source: 'MetroCore' });

        } catch (error) {
            console.error('[MetroCore] Initialization failed:', error);
            this._emitError('initialize', error);
            console.error(`MetroCore initialization failed: ${error.message}`);
        }
    }

    // ALL original methods preserved exactly as they were:
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

    startPolling(interval = 60000) {
        return this._subsystems.api.startPolling(interval);
    }

    stopPolling() {
        return this._subsystems.api.stopPolling();
    }

    sendFullStatusReport() {
        return this._engines.status.sendFullReport();
    }

    healthCheck() {
        return this._engines.status.healthCheck();
    }

    getStationManager() {
        return this._subsystems.managers.stations;
    }

    getLineManager() {
        return this._subsystems.managers.lines;
    }

    getCurrentData() {
        return this.api.getProcessedData();
    }

    cleanup() {
        if (this._subsystems.api) {
            this._subsystems.api.cleanup();
        }
        this._removeAllListeners();
    }

    // All other original methods remain unchanged:
    _enrichLines() {
        return this._engines.data.enrichLines();
    }

    _enrichStations() {
        return this._engines.data.enrichStations();
    }

    _updateListenerStats(event) {
        this._engines.events.updateListenerStats(event);
    }

    _checkBackpressure() {
        this._engines.events.checkBackpressure();
    }

    _calculateCurrentLoad() {
        return this._engines.schedule.calculateCurrentLoad();
    }

    _determineEmbedColor(status) {
        return this._engines.status.determineEmbedColor(status);
    }

    _generateLineStatusSummary(lines) {
        return this._engines.status.generateLineStatusSummary(lines);
    }

/**
 * Refreshes static data from source files and updates all dependent subsystems
 * @returns {Promise<void>} Resolves when refresh is complete, rejects on error
 */
async refreshStaticData() {
    if (!this._subsystems?.dataLoader) {
        throw new Error('Cannot refresh data: DataLoader subsystem not initialized');
    }

    try {
        logger.debug('[MetroCore] Refreshing static data...');

        // 1. Load fresh static data
        const newStaticData = await this._subsystems.dataLoader.load();
        
        // 2. Validate basic structure
        if (!newStaticData || typeof newStaticData !== 'object') {
            throw new Error('Loaded data is invalid or empty');
        }

        // 3. Update core references
        this._staticData = newStaticData;
        this._dataVersion = newStaticData.version || `1.0.0-${Date.now()}`;
        this._combinedData.lastUpdated = new Date();

        // 4. Update managers with new data
        await Promise.all([
            this._subsystems.managers.stations.updateData(
                this._createStationInterface(newStaticData.stations || {})
            ),
            this._subsystems.managers.lines.updateData(
                this._createLineInterface(newStaticData.lines || {})
            )
        ]);

        // 5. Rebuild combined data
        await this._combineData();

        // 6. Notify subsystems
        //this._subsystems.changeDetector?.handleDataRefresh();
       // this._subsystems.statusProcessor?.processNetworkStatus();

        logger.debug('[MetroCore] Static data refresh completed');
        /*this._safeEmit(EventRegistry.DATA_REFRESHED, {
            version: this._dataVersion,
            timestamp: Date.now()
        });*/

    } catch (error) {
        logger.error('[MetroCore] Static data refresh failed:', error);
        this._emitError('refreshStaticData', error);
        
        // Enter safe mode if data is critically invalid
        if (error.message.includes('invalid') || !this._staticData) {
            await this._enterSafeMode();
        }
        throw error; // Re-throw for caller handling
    }
}


}

module.exports = MetroCore;
