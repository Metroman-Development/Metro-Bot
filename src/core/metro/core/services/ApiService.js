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
const DataProcessor = require('./DataProcessor');
const { translateApiData } = require('../../data/dataTranslator');

class ApiService extends EventEmitter {
    constructor(metro, options = {}) {
        super();
        
        // Core dependencies
        this.metro = metro;
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
        this.processedDataFile = path.join(this.cacheDir, 'processedEstadoRed.php.json');

        // State management
        this.lastRawData = null;
        this.lastProcessedData = null;
        this.lastProcessedTimestamp = null;
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
        this.dataProcessor = new DataProcessor(this.statusProcessor);
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
            getProcessedData: this.getProcessedData.bind(this),
            getCachedData: () => Object.freeze({...this.cachedData}),
            
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
                    hasProcessedData: !!this.lastProcessedData,
                    lastProcessedTimestamp: this.lastProcessedTimestamp,
                    cacheValid: !!this.cachedData,
                    dataVersion: this._dataVersion
                }), 
                
               })
            
           }
                
           
      }
    getProcessedData() {
        // Backward compatible version that EmbedManager expects
        if (!this.lastProcessedData) {
            logger.warn('[ApiService] No processed data available, generating fresh data');
            this.metrics.dataGeneratedCount++;
            const freshData = this.dataProcessor.processData(this.lastRawData || {}, this._dataVersion);
            this._updateProcessedData(freshData);
            return freshData;
        }
        return this.lastProcessedData;
    }

    async fetchNetworkStatus() {
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
                    fromPrimarySource = true;
                    logger.info('[ApiService] Successfully fetched data from API.');
                } catch (fetchError) {
                    logger.warn(`[ApiService] Primary fetch failed: ${fetchError.message}. Falling back to database.`);
                    rawData = await this.dbService.getDbRawData();
                    if (!rawData || !rawData.lineas || Object.keys(rawData.lineas).length === 0) {
                        throw new Error("All data sources failed, including database fallback.");
                    }
                    logger.info("[ApiService] Successfully loaded data from database fallback.");
                }
            } else {
                logger.info('[ApiService] Outside of operating hours. Fetching from database.');
                rawData = await this.dbService.getDbRawData();
                if (!rawData || !rawData.lineas || Object.keys(rawData.lineas).length === 0) {
                    throw new Error("Could not retrieve data from database outside of operating hours.");
                }
                logger.info("[ApiService] Successfully loaded data from database.");
            }


            // PHASE 2c: Process data
            const overrides = await this.metro._subsystems.statusOverrideService.getActiveOverrides();
            const rawDataWithOverrides = this.metro._subsystems.statusOverrideService.applyOverrides(rawData, overrides);
            const randomizedData = this._randomizeStatuses(rawDataWithOverrides);

            const processedData = this.dataProcessor.processData(randomizedData, this._dataVersion);

            const summary = this.generateNetworkSummary(processedData);
            await this.dbService.updateNetworkStatusSummary(summary);


            // console.log(processedData)

            // PHASE 2d: Update data state
            this.lastRawData = rawData;


            this.lastProcessedData = processedData;


            //this._updateProcessedData(processedData);
            this._updateState(processedData);

            // PHASE 2e: Handle changes
            if (!this.isFirstTime) {
                const dbRawData = await this.dbService.getDbRawData();
                await this._handleDataChanges(randomizedData, processedData, dbRawData);
            }
            if (fromPrimarySource) {
                await this.updateDbWithApiData(randomizedData);
            }


            // PHASE 2f: Persist data
            await this._storeProcessedData(processedData);

            this.metrics.lastSuccess = new Date();

            // console.log(this.lastProcessedData)



            return processedData;
        } catch (error) {
            logger.error(`[ApiService] Fetch failed`, {
                error
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

    _updateProcessedData(newData) {
        const now = new Date();
        this.lastProcessedData = newData 
            
        this.lastProcessedTimestamp = now;
        logger.debug('[ApiService] Processed data updated', {
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

    async _handleDataChanges(rawData, processedData, previousRawData) {
        const changeResult = this.changeDetector.analyze(rawData, previousRawData);
        if (changeResult.changes?.length > 0) {
            this.changeHistory.unshift(...changeResult.changes);
            this.metrics.changeEvents += changeResult.changes.length;
            this._emitChanges(changeResult, processedData);

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

            apiChanges.unshift(rawData);
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

    _emitChanges(changeResult, processedData) {
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
                ...(this.lastProcessedData && { previousState: this.lastProcessedData }),
                ...(processedData && { newState: processedData })
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
            lastUpdate: this.lastProcessedTimestamp || null,
            chaosFactor: this.chaosFactor,
            debugMode: this.debug,
            activeRequests: this._activeRequests.size,
            staticData: {
                lastRefresh: this.metro.api.getDataFreshness().lastRefresh,
                refreshCount: this.metrics.staticDataRefreshes
            },
            dataState: {
                version: this._dataVersion,
                freshness: this.lastProcessedTimestamp ? 
                    (new Date() - this.lastProcessedTimestamp) : null,
                source: this.lastProcessedData?._metadata?.source || 'unknown'
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
    
    async _storeProcessedData(data) {
        try {
            await fsp.mkdir(this.cacheDir, { recursive: true });
            const dataToStore = {
                ...data,
                _storedAt: new Date().toISOString(),
                _cacheVersion: this._dataVersion
            };
            await fsp.writeFile(
                this.processedDataFile,
                JSON.stringify(dataToStore, null, 2),
                'utf8'
            );
            logger.debug('[ApiService] Processed data stored successfully');
        } catch (error) {
            logger.error('[ApiService] Failed to store processed data', { error });
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
        }, this.lastProcessedData);
        
        return simulatedChange;
    }

    generateNetworkSummary(processedData) {
        if (!processedData || !processedData.lines) {
            return {
                lines: { total: 0, operational: 0, with_issues: [] },
                stations: { total: 0, operational: 0, with_issues: [] },
                timestamp: new Date().toISOString()
            };
        }
        const lines = Object.values(processedData.lines);
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

    async updateDbWithApiData(rawData) {
        for (const lineId in rawData.lineas) {
            const lowerLineId = lineId.toLowerCase();
            const line = rawData.lineas[lineId];
            await this.dbService.updateLineStatus(lowerLineId, line.estado, line.mensaje, line.mensaje_app);
            if (line.estaciones) {
                for (const station of line.estaciones) {
                    await this.dbService.updateStationStatus(station.codigo.toUpperCase(), lowerLineId, station.estado, station.descripcion, station.descripcion_app);
                }
            }
        }
    }

    async forceApiFetchAndPopulateDb() {
        try {
            logger.info('[ApiService] Forcing API fetch to populate database...');
            const rawData = await this.estadoRedService.fetchStatus();
            await this.updateDbWithApiData(rawData);
            logger.info('[ApiService] Database populated with initial data from API.');
        } catch (error) {
            logger.error('[ApiService] Failed to force fetch and populate database:', { error });
            // In a real scenario, we might want to throw this error
            // to prevent the application from starting in a bad state.
        }
    }
}

module.exports = ApiService;
