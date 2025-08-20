// modules/metro/core/services/ApiService.js// modules/metro/core/services/ApiService.js
require('dotenv').config()
// modules/metro/core/services/ApiService.js
const EventEmitter = require('events');
const { fetch } = require('undici');
const crypto = require('crypto');
const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const { performance } = require('perf_hooks');
const TimeHelpers = require('../../../chronos/timeHelpers');
const logger = require('../../../../events/logger');
const EventRegistry = require('../../../../core/EventRegistry');
const EventPayload = require('../../../../core/EventPayload');
const config = require('../../../../config/metro/metroConfig');
const StatusOverrideService = require('./StatusOverrideService');
const EstadoRedService = require('./EstadoRedService');
const { translateApiData } = require('../../data/DataManager');

class ApiService extends EventEmitter {
    constructor(metro, options = {}, dataEngine) {
        super();
        
        // Core dependencies
        this.metro = metro;
        this.dataEngine = dataEngine;
        this.debug = options.debug || false;
        this.chaosFactor = options.chaosFactor || 2000;
        this._cycleCount = 0;
        this.checkCount = 1;

        // Status configuration
        this._statusOptions = {
            lineStatuses: {
                '1': { mensaje: 'Operativo', mensaje_app: 'Operational' },
                '2': { mensaje: 'Con demoras', mensaje_app: 'Delayed' },
                '3': { mensaje: 'Servicio parcial', mensaje_app: 'Partial service' },
                '4': { mensaje: 'Suspendido', mensaje_app: 'Suspended' }
            },
            stationStatuses: {
                '1': { descripcion: 'Operativa', descripcion_app: 'Operational' },
                '2': { descripcion: 'Con demoras', descripcion_app: 'Delayed' },
                '3': { descripcion: 'Servicio parcial', descripcion_app: 'Partial service' },
                '4': { descripcion: 'Suspendida', descripcion_app: 'Suspended' }
            }
        };

        // Path configuration
        this.cacheDir = path.join(__dirname, '../../../../data');
        this.currentDataFile = path.join(this.cacheDir, 'processedEstadoRed.php.json');

        // State management
        this.lastRawData = null;
        this.lastCurrentData = null;
        this.lastCurrentTimestamp = null;
        this.cachedData = null;
        this.changeHistory = [];
        this.isPolling = false;
        this.isFetching = false;
        this._activeRequests = new Set();
        this._pollInterval = null;
        this._backoffDelay = 0;
        this.isFirstTime = true;
        this._dataVersion = `1.0.0-${Date.now()}`;

        // Service dependencies
        this.timeHelpers = TimeHelpers;
        this.override = this.metro._subsystems.statusOverrideService;
        this.statusProcessor = options.statusProcessor;
        this.changeDetector = options.changeDetector;
        this.estadoRedService = new EstadoRedService({ timeHelpers: this.timeHelpers, config: config });

        if (!options.dbService) {
            throw new Error('[ApiService] A dbService instance is required in options.');
        }
        this.dbService = options.dbService;

        // Metrics
        this.metrics = {
            totalRequests: 0,
            failedRequests: 0,
            changeEvents: 0,
            lastSuccess: null,
            lastFailure: null,
            cacheHits: 0,
            avgResponseTime: 0,
            lastProcessingTime: 0,
            staticDataRefreshes: 0,
            refreshSkipped: 0,
            dataStaleCount: 0,
            dataGeneratedCount: 0
        };

        // Public API
        this.api = {
            // Data access
            getRawData: () => this.lastRawData ? Object.freeze({...this.lastRawData}) : null,
            getCurrentData: this.getCurrentData.bind(this),
            getCachedData: () => Object.freeze({...this.cachedData}),
            
            prepareEventOverrides: async (eventDetails) => await this.prepareEventOverrides(eventDetails), 
            
            // Status information
            status: this.getSystemStatus.bind(this),
            metrics: this.getMetrics.bind(this),
            
            // Change tracking
            changes: Object.freeze({
                history: this.getChangeHistory.bind(this),
                last: this.getLastChange.bind(this),
                stats: this.getChangeStats.bind(this),
                subscribe: (listener) => this.on(EventRegistry.CHANGES_DETECTED, listener),
                unsubscribe: (listener) => this.off(EventRegistry.CHANGES_DETECTED, listener)
            }),
            
            // Configuration
            reloadOverrides: async () => {
                const result = await this.override.loadOverrides();
                return { 
                    success: result, 
                    timestamp: new Date(),
                    overrides: this.override.getOverrides()
                };
            },
            
            // Control methods
            startPolling: this.startPolling.bind(this),
            stopPolling: this.stopPolling.bind(this),
            forceFetch: this.fetchNetworkStatus.bind(this),
            
            // Debugging
            debug: Object.freeze({
                simulateChange: this._simulateChange.bind(this),
                setChaosFactor: (factor) => {
                    this.chaosFactor = Math.max(0, Math.min(10000, factor));
                    return this.chaosFactor;
                },
                toggleDebug: (state) => {
                    this.debug = typeof state === 'boolean' ? state : !this.debug;
                    return this.debug;
                },
                getDataState: () => ({
                    hasRawData: !!this.lastRawData,
                    hasCurrentData: !!this.lastCurrentData,
                    lastCurrentTimestamp: this.lastCurrentTimestamp,
                    cacheValid: !!this.cachedData,
                    dataVersion: this._dataVersion
                }), 
                
               })
            
           }
                
           
      }
   
    // Add to ApiService class

/**
 * Gets the override service instance
 * @returns {ApiServiceOverride} The override service instance
 */
getOverridesService() {
    if (!this.override) {
        throw new Error('Override service not initialized');
    }
    return this.override;
}

/**
 * Updates overrides and persists them to disk
 * @param {object} updates - The updates to apply
 * @param {object} updates.lines - Line overrides to update
 * @param {object} updates.stations - Station overrides to update
 * @returns {Promise<boolean>} True if successful
 */
async updateOverrides(updates = {}) {
    try {
        const overrideService = this.getOverridesService();
        
        // Apply updates
        if (updates.lines) {
            Object.assign(overrideService.overrides.lines, updates.lines);
        }
        if (updates.stations) {
            Object.assign(overrideService.overrides.stations, updates.stations);
        }
        
        // Persist to disk
        await fsp.writeFile(
            overrideService.overrideFile,
            JSON.stringify(overrideService.overrides, null, 2),
            'utf8'
        );
        
        // Update lastModified
        const stats = await fsp.stat(overrideService.overrideFile);
        overrideService.lastModified = stats.mtimeMs;
        
        logger.debug('[ApiService] Overrides updated successfully');
        return true;
    } catch (error) {
        logger.error('[ApiService] Failed to update overrides', { error });
        return false;
    }
}

    
/**
 * Removes overrides and persists changes to disk
 * @param {object} removals - The removals to apply
 * @param {string[]} removals.lines - Line IDs to remove
 * @param {string[]} removals.stations - Station codes to remove
 * @returns {Promise<boolean>} True if successful
 */
async removeOverrides(removals = {}) {
    try {
        const overrideService = this.getOverridesService();
        
        // Apply removals
        if (removals.lines) {
            removals.lines.forEach(lineId => {
                delete overrideService.overrides.lines[lineId];
            });
        }
        if (removals.stations) {
            removals.stations.forEach(stationCode => {
                delete overrideService.overrides.stations[stationCode];
            });
        }
        
        // Persist to disk
        await fsp.writeFile(
            overrideService.overrideFile,
            JSON.stringify(overrideService.overrides, null, 2),
            'utf8'
        );
        
        // Update lastModified
        const stats = await fsp.stat(overrideService.overrideFile);
        overrideService.lastModified = stats.mtimeMs;
        
        logger.debug('[ApiService] Overrides removed successfully');
        return true;
    } catch (error) {
        logger.error('[ApiService] Failed to remove overrides', { error });
        return false;
    }
}
    
    // In ApiService class

/**
 * Prepares event overrides (disabled by default)
 * @param {object} eventDetails - The event details
 * @returns {Promise<boolean>} True if successful
 */
   async prepareEventOverrides(eventDetails) {
    logger.info("Preparando Overrides", { eventDetails });

    if (!eventDetails?.closedStations && !eventDetails?.operationalStations) return false;

    const overrideService = this.getOverridesService();
    const lineOverrides = {};
    const stationOverrides = {};

    // Get current data (either last fetched or generated closed state)
    const currentData = this.lastRawData || {};

    // Prepare line overrides (disabled by default)
    const allAffectedLines = new Set([
        ...Object.keys(eventDetails.closedStations || {}),
        ...Object.keys(eventDetails.operationalStations || {})
    ]);

    allAffectedLines.forEach(lineId => {
        lineOverrides[lineId.toLowerCase()] = { // Standardize to lowercase
            estado: 5,
            mensaje: `Servicio afectado por Evento: ${eventDetails.name}`,
            mensaje_app: `Servicio afectado por Evento`,
            enabled: false // Disabled by default
        };
    });

    // Process closed stations (exact name match)
    if (eventDetails.closedStations) {
        Object.entries(eventDetails.closedStations).forEach(([lineId, stationNames]) => {
            const lineKey = lineId.toLowerCase(); // Standardize to lowercase
            const lineData = currentData[lineKey];

            if (lineData && lineData.estaciones) {
                stationNames.forEach(stationName => {
                    const station = lineData.estaciones.find(s =>
                        s.nombre.includes(stationName) // Exact match
                    );

                    if (station) {
                        stationOverrides[station.codigo.toUpperCase()] = { // Standardize to uppercase
                            estado: 5,
                            descripcion: "Servicio Extendido Únicamente para Salida",
                            descripcion_app: "Horario Extendido por Evento",
                            enabled: false
                        };
                    } else {
                        logger.warn(`Closed station "${stationName}" not found in line ${lineKey}`);
                    }
                });
            } else {
                logger.warn(`Line ${lineKey} not found in current data for closed stations`);
            }
        });
    }

    // Process operational stations (search across all lines)
    if (eventDetails.operationalStations) {
        eventDetails.operationalStations.forEach(stationName => {
            let found = false;

            // Search through all lines
            for (const [lineKey, lineData] of Object.entries(currentData)) {
                if (lineKey.startsWith('l') && lineData.estaciones) {
                    const station = lineData.estaciones.find(s =>
                        s.nombre === stationName
                    );

                    if (station) {
                        stationOverrides[station.codigo.toUpperCase()] = { // Standardize to uppercase
                            estado: 5,
                            descripcion: "Servicio Extendido Únicamente para Entrada",
                            descripcion_app: "Horario Extendido por Evento",
                            enabled: false
                        };
                        found = true;
                        break; // Stop searching once found
                    }
                }
            }

            if (!found) {
                logger.warn(`Operational station "${stationName}" not found in any line`);
            }
        });
    }
  
    
    
    logger.info("Generated station overrides:", { stationOverrides });
    return this.updateOverrides({
        lines: lineOverrides,
        stations: stationOverrides
    });
}
    
    
/**
 * Cleans up event overrides if not event day
 * @param {object} eventDetails - The event details
 * @returns {Promise<boolean>} True if cleaned or no cleanup needed
 */
async cleanupEventOverridesIfNeeded(eventDetails) {
    const now = new Date();
    const eventDate = new Date(eventDetails?.date);
    
    // Only clean up if it's not the event day
    if (eventDetails && now.toDateString() === eventDate.toDateString()) {
        return false;
    }

    const overrideService = this.getOverridesService();
    const removals = {
        lines: Object.keys(overrideService.overrides.lines)
            .filter(lineId => overrideService.overrides.lines[lineId].enabled === false),
        stations: Object.keys(overrideService.overrides.stations)
            .filter(stationId => overrideService.overrides.stations[stationId].enabled === false)
    };

    if (removals.lines.length > 0 || removals.stations.length > 0) {
        return this.removeOverrides(removals);
    }
    return true;
}

/**
 * Activates prepared event overrides
 * @param {object} eventDetails - The event details
 * @returns {Promise<boolean>} True if successful
 */
async activateEventOverrides(eventDetails) {
    if (!eventDetails?.closedStations) return false;

    const overrideService = this.getOverridesService();
    const updates = {
        lines: {},
        stations: {}
    };

    // Enable line overrides
    Object.keys(eventDetails.closedStations).forEach(lineId => {
        if (overrideService.overrides.lines[lineId]) {
            updates.lines[lineId] = { enabled: true };
        }
    });

    // Enable station overrides
    Object.entries(eventDetails.closedStations).forEach(([lineId, stations]) => {
        stations.forEach(stationId => {
            if (overrideService.overrides.stations[stationId]) {
                updates.stations[stationId] = { enabled: true };
            }
        });
    });

    return this.updateOverrides(updates);
}

    async getCurrentData() {
        // This function now fetches data directly from the database, processes it, and returns it.
        // It ensures that the embed manager always has the most up-to-date information from the database.
        logger.debug('[ApiService] getCurrentData called. Fetching fresh data from database.');
        const dbRawData = await this.getDbRawData();
        const currentData = await this._processData(dbRawData);
        
        this._updateCurrentData(currentData);
        return currentData;
    }

    async fetchNetworkStatus() {
        logger.detailed('[ApiService] Starting fetchNetworkStatus');
        if (this.isFetching) {
            logger.warn('[ApiService] Fetch already in progress. Skipping.');
            return;
        }
        this.isFetching = true;

        if (this.isFirstTime) {
            logger.info('[ApiService] First run detected. Forcing API fetch to populate database.');
            // Force fetch from API and populate DB, then proceed
            await this.forceApiFetchAndPopulateDb();
        }

        // PHASE 1: Ensure static data freshness
        await this._ensureStaticDataFreshness();

        // PHASE 2: Execute network fetch
        const requestId = crypto.randomUUID();
        this._activeRequests.add(requestId);
        this.metrics.totalRequests++;
        const startTime = performance.now();

        if ((this.checkCount - 1) / 15 === 1 || this.checkCount - 1 === 0) {
            // This will be handled by the SchedulerService
        }

        if (this.metrics.totalRequests > 1) {
            this.checkCount++
        }

        try {
            let rawData;
            let fromPrimarySource = false;

            if (this.timeHelpers.isWithinOperatingHours()) {
                logger.info('[ApiService] Within operating hours. Fetching from API.');
                try {
                    // PHASE 2a: Fetch raw data from API/cache
                    rawData = await this.estadoRedService.fetchStatus();
                    logger.detailed('[ApiService] Fetched raw data from estadoRedService', rawData);
                    fromPrimarySource = true;
                    logger.info('[ApiService] Successfully fetched data from API.');
                } catch (fetchError) {
                    logger.warn(`[ApiService] Primary fetch failed: ${fetchError.message}. Falling back to database.`);
                    rawData = await this.getDbRawData();
                    if (!rawData || !rawData.lineas || Object.keys(rawData.lineas).length === 0) {
                        throw new Error("All data sources failed, including database fallback.");
                    }
                    logger.info("[ApiService] Successfully loaded data from database fallback.");
                }
            } else {
                logger.info('[ApiService] Outside of operating hours. Generating off-hours data.');
                rawData = await this._generateOffHoursData();
            }


            // PHASE 2c: Process data
            const overrides = await this.metro._subsystems.statusOverrideService.getActiveOverrides();
            logger.detailed('[ApiService] Active overrides', overrides);
            const rawDataWithOverrides = this.metro._subsystems.statusOverrideService.applyOverrides(rawData, overrides);
            logger.detailed('[ApiService] Raw data after applying overrides', rawDataWithOverrides);
            const randomizedData = this._randomizeStatuses(rawDataWithOverrides);
            logger.detailed('[ApiService] Data after randomizing statuses', randomizedData);

            const currentData = await this._processData(randomizedData);


            console.log(currentData);
            
            const summary = this.generateNetworkSummary(currentData);
            await this.dbService.updateNetworkStatusSummary(summary);


            // console.log(currentData)

            // PHASE 2d: Update data state
            this.lastRawData = rawData;


            this.lastCurrentData = currentData;


            //this._updateCurrentData(currentData);
            this._updateState(currentData);

            // PHASE 2e: Handle changes
            if (!this.isFirstTime) {
                const dbRawData = await this.getDbRawData();
                await this._handleDataChanges(randomizedData, currentData, dbRawData);
            }
            if (fromPrimarySource) {
                // The old partial update is replaced by the new comprehensive one.
                // await this.dbService.updateAllData(currentData);
            }


            // PHASE 2f: Persist data
            await this._storeCurrentData(currentData);

            this.metrics.lastSuccess = new Date();

            // console.log(this.lastCurrentData)



            return currentData;
        } catch (error) {
            logger.error(`[ApiService] Fetch failed`, {
                error: error.message,
                stack: error.stack
            });
            this.metrics.failedRequests++;
            this.metrics.lastFailure = new Date();
            return null;
        } finally {
            const processingTime = performance.now() - startTime;
            this.metrics.avgResponseTime =
                (this.metrics.avgResponseTime * (this.metrics.totalRequests - 1) + processingTime) /
                this.metrics.totalRequests;
            this.metrics.lastProcessingTime = processingTime;
            this._activeRequests.delete(requestId);
            this.isFirstTime = false;
            this.isFetching = false;
        }
    }

    _updateCurrentData(newData) {
        const now = new Date();
        this.lastCurrentData = newData

       // console.log(newData);
        
        this.lastCurrentTimestamp = now;
        logger.debug('[ApiService] Current data updated', {
            timestamp: now.toISOString(),
            dataVersion: this._dataVersion
        });
    }

    async _ensureStaticDataFreshness() {
        try {
            if (!this.timeHelpers.isWithinOperatingHours()) {
                logger.info('[ApiService] Outside of operating hours. Skipping static data freshness check.');
                return;
            }

            const maxAge = config.api.minStaticDataFreshness || 300000;  // 5 minutes during operations

            const refreshed = await this.metro.refreshStaticData({
                maxAge,
                silent: !this.debug,
                force: this.isFirstTime
            });

            if (refreshed) {
                this.metrics.staticDataRefreshes++;
            } else {
                this.metrics.refreshSkipped++;
            }
        } catch (error) {
            logger.warn('[ApiService] Static data refresh failed, proceeding with existing data:', { error });
        }
    }

    async _processData(rawData) {
        logger.detailed('[ApiService] Starting data processing', rawData);
        const translatedData = await translateApiData(rawData);
        logger.detailed('[ApiService] Translated data', translatedData);
        return this.statusProcessor
            ? this.statusProcessor.processRawAPIData(translatedData, 'MetroApp')
            : this._basicProcessData(translatedData);
    }

    _generateNetworkStatus(lines) {
        if (!lines || Object.keys(lines).length === 0) {
            return { status: 'outage', lastUpdated: new Date().toISOString() };
        }

        const lineStatuses = Object.values(lines).map(line => line.status);
        const operationalLines = lineStatuses.filter(s => s === '1').length;
        const totalLines = lineStatuses.length;
        const degradedLines = totalLines - operationalLines;

        let overallStatus = 'operational';
        if (degradedLines > 0 && operationalLines === 0) {
            overallStatus = 'outage';
        } else if (degradedLines > 0) {
            overallStatus = 'degraded';
        }

        return {
            status: overallStatus,
            lastUpdated: new Date().toISOString()
        };
    }

    _basicProcessData(rawData) {
        const lines = Object.fromEntries(
            Object.entries(rawData.lineas || {})
                .filter(([k, lineData]) => k.toLowerCase().startsWith('l') && lineData.nombre)
                .map(([lineId, lineData]) => {
                    const lowerLineId = lineId.toLowerCase();
                    return [
                        lowerLineId,
                        {
                            id: lowerLineId,
                            displayName: lineData.nombre,
                            status: lineData.estado,
                            message: lineData.mensaje,
                            message_app: lineData.mensaje_app,
                            stations: lineData.estaciones?.filter(s => s.codigo && s.nombre).map(station => ({
                                ...station,
                                id: station.codigo.toUpperCase(),
                                linea: lowerLineId,
                                name: station.nombre,
                                status: station.estado,
                                description: station.descripcion,
                                description_app: station.descripcion_app,
                                transfer: station.combinacion || ''
                            })) || []
                        }
                    ];
                })
        );

        const networkStatus = this._generateNetworkStatus(lines);

        const currentData = {
            lines,
            network: networkStatus,
            stations: {},
            version: this._dataVersion,
            lastUpdated: new Date().toISOString(),
            _metadata: {
                source: 'generated',
                timestamp: new Date(),
                generation: 'basic'
            }
        };

        currentData.stations = Object.values(currentData.lines)
            .flatMap(line => line.stations)
            .reduce((acc, station) => {
                acc[station.id] = station;
                return acc;
            }, {});

        // Store the processed data immediately
        this._updateCurrentData(currentData);
        return currentData;
    }

    async _generateOffHoursData() {
        const dbData = await this.getDbRawData();
        if (!dbData || !dbData.lineas) {
            logger.error('[ApiService] Cannot generate off-hours data: no data from database.');
            return { lineas: {} };
        }

        const offHoursData = JSON.parse(JSON.stringify(dbData));

        for (const lineId in offHoursData.lineas) {
            const line = offHoursData.lineas[lineId];
            line.estado = '15';
            line.mensaje = 'Fuera de Horario Operativo';
            line.mensaje_app = 'Fuera de Horario Operativo';

            if (line.estaciones) {
                for (const station of line.estaciones) {
                    station.estado = '15';
                    station.descripcion = 'Fuera de Horario Operativo';
                    station.descripcion_app = 'Fuera de Horario Operativo';
                }
            }
        }

        return offHoursData;
    }

    async _handleDataChanges(rawData, currentData, previousRawData) {
        const rawDataWithTimestamp = { ...rawData, timestamp: new Date().toISOString() };
        const changeResult = await this.changeDetector.analyze(rawDataWithTimestamp, previousRawData, currentData);
        logger.detailed('[ApiService] Change detection result', changeResult);
        if (this.isFirstTime) {
            await this.dbService.updateAllData(currentData, 'MetroApp');
        } else if (changeResult.changes?.length > 0) {
            await this.dbService.updateChanges(changeResult.changes, 'MetroApp');
        }
        if (changeResult.changes?.length > 0) {
            this.changeHistory.unshift(...changeResult.changes);
            this.metrics.changeEvents += changeResult.changes.length;
            this._emitChanges(changeResult, currentData);

            const apiChangesPath = path.join(this.cacheDir, 'apiChanges.json');
            let apiChanges = [];
            try {
                const data = await fsp.readFile(apiChangesPath, 'utf8');
                apiChanges = JSON.parse(data);
            } catch (error) {
                if (error.code !== 'ENOENT') {
                    logger.error('[ApiService] Failed to read apiChanges.json', { error });
                }
            }

            apiChanges.unshift(rawDataWithTimestamp);
            if (apiChanges.length > 10) {
                apiChanges = apiChanges.slice(0, 10);
            }

            try {
                await fsp.writeFile(apiChangesPath, JSON.stringify(apiChanges, null, 2), 'utf8');
            } catch (error) {
                logger.error('[ApiService] Failed to write apiChanges.json', { error });
            }
        }
    }

    _updateState(newData) {
        logger.debug('[ApiService] Updating service state');
        this.cachedData = newData;
        this.emit('data', newData);
        this._emitRawData(newData, false);
    }

    _randomizeStatuses(data) {
        if (!this.debug || !data) return data;
        
        this._cycleCount++;
        const prob = Math.max(0.1, 1 - (this.chaosFactor / 100));
        logger.debug(`[ApiService] Applying chaos (factor: ${this.chaosFactor}, prob: ${prob})`);

        Object.entries(data || {}).forEach(([lineId, line]) => {
            if (Math.random() < prob) {
                const newStatus = Math.floor(Math.random() * 4) + 1;
                logger.debug(`[ApiService] Changing ${lineId} to status ${newStatus}`);
                line.estado = newStatus.toString();
                line.mensaje = this._statusOptions.lineStatuses[newStatus].mensaje;
                line.mensaje_app = this._statusOptions.lineStatuses[newStatus].mensaje_app;
            }

            line.estaciones?.forEach(station => {
                if (Math.random() < prob * 0.7) {
                    const newStatus = Math.floor(Math.random() * 4) + 1;
                    station.estado = newStatus.toString();
                    station.descripcion = this._statusOptions.stationStatuses[newStatus].descripcion;
                    station.descripcion_app = this._statusOptions.stationStatuses[newStatus].descripcion_app;
                }
            });
        });

        return data;
    }

    _emitRawData(rawData, hasChanges) {
        const dataWithVersion = {
            ...rawData,
            version: rawData.version || this._dataVersion,
        };

        const payload = new EventPayload(
            EventRegistry.RAW_DATA_FETCHED,
            Object.freeze(dataWithVersion),
            {
                source: 'ApiService',
                timestamp: new Date(),
                containsChanges: hasChanges
            }
        );

        this.emit(EventRegistry.RAW_DATA_FETCHED, payload);
    }

    _emitChanges(changeResult, currentData) {
        if (!changeResult?.changes || changeResult.changes.length === 0) return;

        const changesArray = Array.isArray(changeResult.changes) 
            ? changeResult.changes 
            : [changeResult.changes].filter(Boolean);

        const validatedChanges = changesArray.map(change => {
            // Basic validation to ensure the change object is well-formed
            if (!change || typeof change.id === 'undefined' || typeof change.type === 'undefined') {
                logger.warn('[ApiService] Invalid change object detected. Skipping.', { change });
                return null;
            }

            return {
                type: change.type,
                id: String(change.id),
                name: change.name || 'unknown',
                line: change.line,
                from: String(change.from || 'unknown'),
                to: String(change.to || 'unknown'),
                description: String(change.description || change.message || ''),
                timestamp: change.timestamp ? new Date(change.timestamp).toISOString() : new Date().toISOString(),
                severity: ['critical', 'high', 'medium', 'low', 'none'].includes(change.severity)
                    ? change.severity
                    : 'none'
            };
        }).filter(Boolean);

        const metadata = {
            severity: ['critical','high','medium','low','none'].includes(changeResult.severity)
                ? changeResult.severity
                : 'none',
            source: 'ApiService',
            timestamp: new Date().toISOString(),
            ...(Array.isArray(changeResult.groupedStations) && {
                groupedStations: changeResult.groupedStations
            })
        };

        const payload = new EventPayload(
            EventRegistry.CHANGES_DETECTED,
            {
                changes: validatedChanges,
                metadata: metadata,
                ...(this.lastCurrentData && { previousState: this.lastCurrentData }),
                ...(currentData && { newState: currentData })
            }
        );

        this.emit(EventRegistry.CHANGES_DETECTED, payload);
    }

    getChangeHistory() {
        return Object.freeze({
            entries: [...this.changeHistory],
            stats: this.getChangeStats()
        });
    }

    getChangeStats() {
        return Object.freeze({
            total: this.metrics.changeEvents,
            lastChange: this.changeHistory[0]?.timestamp || null,
            perHour: this._calculateChangesPerHour()
        });
    }

    _calculateChangesPerHour() {
        if (this.changeHistory.length < 2) return 0;
        const first = new Date(this.changeHistory[0].timestamp);
        const last = new Date(this.changeHistory[this.changeHistory.length - 1].timestamp);
        const hours = (first - last) / (1000 * 60 * 60);
        return hours > 0 ? (this.changeHistory.length / hours).toFixed(2) : 0;
    }

    getMetrics() {
        return Object.freeze({
            requests: {
                total: this.metrics.totalRequests,
                failed: this.metrics.failedRequests,
                successRate: this._calculateSuccessRate()
            },
            lastSuccess: this.metrics.lastSuccess,
            lastFailure: this.metrics.lastFailure,
            activeRequests: this._activeRequests.size,
            backoffDelay: this._backoffDelay,
            cacheHits: this.metrics.cacheHits,
            avgResponseTime: this.metrics.avgResponseTime,
            staticData: {
                refreshes: this.metrics.staticDataRefreshes,
                skipped: this.metrics.refreshSkipped
            },
            dataMetrics: {
                staleCount: this.metrics.dataStaleCount,
                generatedCount: this.metrics.dataGeneratedCount
            }
        });
    }
    
    _calculateSuccessRate() {
        if (this.metrics.totalRequests === 0) return 0;
        return Math.round(
            ((this.metrics.totalRequests - this.metrics.failedRequests) / 
             this.metrics.totalRequests) * 100
        );
    }

    getLastChange() {
        return this.changeHistory[0] ? Object.freeze({...this.changeHistory[0]}) : null;
    }

    getSystemStatus() {
        return {
            isPolling: this.isPolling,
            lastUpdate: this.lastCurrentTimestamp || null,
            chaosFactor: this.chaosFactor,
            debugMode: this.debug,
            activeRequests: this._activeRequests.size,
            overridesActive: Object.values(this.override.getOverrides().lines).some(o => o.enabled) || 
                           Object.values(this.override.getOverrides().stations).some(o => o.enabled),
            staticData: {
                lastRefresh: this.metro.api.getDataFreshness().lastRefresh,
                refreshCount: this.metrics.staticDataRefreshes
            },
            dataState: {
                version: this._dataVersion,
                freshness: this.lastCurrentTimestamp ?
                    (new Date() - this.lastCurrentTimestamp) : null,
                source: this.lastCurrentData?._metadata?.source || 'unknown'
            }
        };
    }

    startPolling(interval = config.api.pollingInterval) {
        if (this.isPolling) return;

        interval = Math.max(60000, interval);
        logger.info(`[ApiService] Starting polling (${interval}ms)`);
        this.isPolling = true;
        this._pollInterval = setInterval(() => {
            this.fetchNetworkStatus()
                .catch(error => logger.error('[ApiService] Polling error:', error));
        }, interval);

        if (this._pollInterval.unref) {
            this._pollInterval.unref();
        }
    }

    stopPolling() {
        if (!this.isPolling) return;

        logger.info('[ApiService] Stopping polling');
        clearInterval(this._pollInterval);
        this._pollInterval = null;
        this.isPolling = false;
    }

    cleanup() {
        logger.info('[ApiService] Performing cleanup');
        this.stopPolling();
        this.removeAllListeners();
        this._activeRequests.clear();
        this.changeHistory = [];
    }
    
    async _storeCurrentData(data) {
        try {
            await fsp.mkdir(this.cacheDir, { recursive: true });
            const dataToStore = {
                ...data,
                _storedAt: new Date().toISOString(),
                _cacheVersion: this._dataVersion
            };
            await fsp.writeFile(
                this.currentDataFile,
                JSON.stringify(dataToStore, null, 2),
                'utf8'
            );
            logger.debug('[ApiService] Current data stored successfully');
        } catch (error) {
            logger.error('[ApiService] Failed to store current data', { error });
        }
    }

    _simulateChange(type, data) {
        logger.warn('[ApiService] Simulating change event', { type, data });
        const simulatedChange = {
            type: type || 'simulated',
            id: data?.id || 'simulated_' + Date.now(),
            from: data?.from || '1',
            to: data?.to || '2',
            timestamp: new Date().toISOString(),
            severity: data?.severity || 'medium'
        };
        
        this._emitChanges({
            changes: [simulatedChange],
            severity: simulatedChange.severity
        }, this.lastCurrentData);
        
        return simulatedChange;
    }

    generateNetworkSummary(currentData) {
        if (!currentData || !currentData.lines) {
            return {
                lines: { total: 0, operational: 0, with_issues: [] },
                stations: { total: 0, operational: 0, with_issues: [] },
                timestamp: new Date().toISOString()
            };
        }
        const lines = Object.values(currentData.lines);
        const stations = lines.flatMap(line => line.stations || []);

        return {
            lines: {
                total: lines.length,
                operational: lines.filter(line => line.status === '1').length,
                with_issues: lines.filter(line => line.status !== '1').map(line => line.id),
            },
            stations: {
                total: stations.length,
                operational: stations.filter(station => station.status === '1').length,
                with_issues: stations.filter(station => station.status !== '1').map(station => station.id),
            },
            timestamp: new Date().toISOString()
        };
    }

    async getDbRawData() {
        const [
            dbLines,
            dbStationsStatus,
            accessibilityStatus,
            incidents,
            incidentTypes,
            trainModels,
            lineFleet,
            statusOverrides,
            scheduledStatusOverrides,
            jsStatusMapping,
            operationalStatusTypes,
            stationStatusHistory,
            statusChangeLog,
            systemInfo,
            intermodalStations,
            intermodalBuses,
            networkStatus
        ] = await Promise.all([
            this.dbService.getAllLinesStatus(),
            this.dbService.getAllStationsStatusAsRaw(),
            this.dbService.getAccessibilityStatus(),
            this.dbService.getAllIncidents(),
            this.dbService.getAllIncidentTypes(),
            this.dbService.getAllTrainModels(),
            this.dbService.getAllLineFleet(),
            this.dbService.getAllStatusOverrides(),
            this.dbService.getAllScheduledStatusOverrides(),
            this.dbService.getAllJsStatusMapping(),
            this.dbService.getAllOperationalStatusTypes(),
            this.dbService.getAllStationStatusHistory(),
            this.dbService.getAllStatusChangeLog(),
            this.dbService.getSystemInfo(),
            this.dbService.getIntermodalStations(),
            this.dbService.getAllIntermodalBuses(), // Assuming you add this method
            this.dbService.getNetworkStatus() // Assuming you add this method
        ]);

        const accessibilityByStation = {};
        for (const item of accessibilityStatus) {
            const stationCode = item.station_code.toUpperCase();
            if (!accessibilityByStation[stationCode]) {
                accessibilityByStation[stationCode] = [];
            }
            accessibilityByStation[stationCode].push(item);
        }

        const dbRawData = {
            lineas: {},
            incidents,
            incidentTypes,
            trainModels,
            lineFleet,
            statusOverrides,
            scheduledStatusOverrides,
            jsStatusMapping,
            operationalStatusTypes,
            stationStatusHistory,
            statusChangeLog,
            systemInfo,
            intermodalStations,
            intermodalBuses,
            networkStatus
        };

        for (const line of dbLines) {
            const lineId = line.line_id.toLowerCase();
            dbRawData.lineas[lineId] = {
                nombre: line.line_name,
                estado: line.status_code,
                mensaje: line.status_message,
                mensaje_app: line.app_message,
                estaciones: []
            };
        }

        const stationsArray = Array.isArray(dbStationsStatus) ? dbStationsStatus : Object.values(dbStationsStatus);
        
        for (const station of stationsArray) {
            const lineId = station.line_id.toLowerCase();
            if (dbRawData.lineas[lineId]) {
                const stationCode = station.station_code.toUpperCase();
                // The new mapping ensures all data from metro_stations is preserved,
                // and the status data is correctly assigned.
                dbRawData.lineas[lineId].estaciones.push({
                    ...station, // Preserves all fields from metro_stations
                    codigo: stationCode,
                    nombre: station.station_name, // Use station_name directly
                    estado: station.estado, // from the alias
                    descripcion: station.descripcion, // from the alias
                    descripcion_app: station.descripcion_app, // from the alias
                    access_details: accessibilityByStation[stationCode] || []
                });
            }
        }
        
        return dbRawData;
    }

    async forceApiFetchAndPopulateDb() {
        try {
            logger.info('[ApiService] Forcing API fetch to populate database...');
            const rawData = await this.estadoRedService.fetchStatus();
            const currentData = await this._processData(rawData);
            // Call the new comprehensive update method
            await this.dbService.updateAllData(currentData);
            logger.info('[ApiService] Database populated with initial data from API.');
        } catch (error) {
            logger.error('[ApiService] Failed to force fetch and populate database:', { error });
            // In a real scenario, we might want to throw this error
            // to prevent the application from starting in a bad state.
        }
    }
}

module.exports = ApiService;
