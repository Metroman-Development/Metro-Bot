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
const NewsService = require('./NewsService');
const StatusOverrideService = require('./StatusOverrideService');
const EstadoRedService = require('./EstadoRedService');

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
        this._activeRequests = new Set();
        this._pollInterval = null;
        this._backoffDelay = 0;
        this.isFirstTime = true;
        this._dataVersion = `1.0.0-${Date.now()}`;

        // Service dependencies
        this.timeHelpers = TimeHelpers;
        this.newsService = new NewsService(metro);
        this.override = new StatusOverrideService();
        this.statusProcessor = options.statusProcessor;
        this.changeDetector = options.changeDetector;
        this.estadoRedService = new EstadoRedService({ timeHelpers: this.timeHelpers, config: config });

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
            newsChecks: 0,
            newsPosted: 0,
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
            
            // News service
            news: Object.freeze({
                check: this.checkNews.bind(this),
                forceCheck: async () => {
                    this.metrics.newsChecks++;
                    const result = await this.newsService.checkNews(true);
                    if (result?.posted) this.metrics.newsPosted += result.posted;
                    return result;
                },
                getPostedCount: () => this.metrics.newsPosted,
                getLastPosted: () => this.newsService.getLastPosted()
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
                injectNews: async (newsData) => {
                    return this.newsService.injectNews(newsData);
                },
                clearNewsCache: () => {
                    return this.newsService.clearCache();
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
        lineOverrides[lineId] = {
            estado: 5,
            mensaje: `Servicio afectado por Evento: ${eventDetails.name}`,
            mensaje_app: `Servicio afectado por Evento`,
            enabled: false // Disabled by default
        };
    });

    // Process closed stations (exact name match)
    if (eventDetails.closedStations) {
        Object.entries(eventDetails.closedStations).forEach(([lineId, stationNames]) => {
            const lineKey = `l${lineId.toLowerCase().replace('l', '').toLowerCase()}`; // Ensure 'l1' format
            const lineData = currentData[lineKey];
            
            if (lineData && lineData.estaciones) {
                stationNames.forEach(stationName => {
                    const station = lineData.estaciones.find(s => 
                        s.nombre.includes(stationName) // Exact match
                    );
                    
                    if (station) {
                        stationOverrides[station.codigo.toLowerCase() ] = {
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

    // Process operational stations (exact name match)
    
        

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
                        stationOverrides[station.codigo] = {
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

    getProcessedData() {
        // Backward compatible version that EmbedManager expects
        if (!this.lastProcessedData) {
            logger.warn('[ApiService] No processed data available, generating fresh data');
            this.metrics.dataGeneratedCount++;
            const freshData = this._basicProcessData(this.lastRawData || this._generateClosedState());
            this._updateProcessedData(freshData);
            return freshData;
        }
        return this.lastProcessedData;
    }

    async fetchNetworkStatus() {
        // PHASE 1: Ensure static data freshness
        await this._ensureStaticDataFreshness();

        // PHASE 2: Execute network fetch
        const requestId = crypto.randomUUID();
        this._activeRequests.add(requestId);
        this.metrics.totalRequests++;
        const startTime = performance.now();

        if ((this.checkCount-1)/15===1||this.checkCount-1===0){
            // This will be handled by the SchedulerService
        }

       if(this.metrics.totalRequests>1){
        this.checkCount++

       }
        try {
            // PHASE 2a: Fetch raw data
            let rawData = await this.estadoRedService.fetchStatus();

            // PHASE 2c: Process data
            const overrides = await this.metro._subsystems.statusOverrideService.getActiveOverrides();
            rawData = this.metro._subsystems.statusOverrideService.applyOverrides(rawData, overrides);
            const randomizedData = this._randomizeStatuses(rawData);
            
            await this._updateCache(rawData);
            
            const processedData = this._processData(randomizedData);
     
            
           // console.log(processedData) 

            // PHASE 2d: Update data state
            this.lastRawData = rawData;
            
            
          this.lastProcessedData = processedData;  
            
            
             //this._updateProcessedData(processedData);
            this._updateState(processedData);

            // PHASE 2e: Handle changes
            if (!this.isFirstTime) {
                this._handleDataChanges(randomizedData, processedData);
            }

            // PHASE 2f: Persist data
            await this._storeProcessedData(processedData);

            // PHASE 2g: Check news
            if (this.timeHelpers.isWithinOperatingHours()) {
                await this._checkForNewsUpdates();
            }
            
            this.metrics.lastSuccess = new Date();
            
           // console.log(this.lastProcessedData) 

           
            
            return processedData;
        } catch (error) {
            logger.error(`[ApiService] Fetch failed`, { error });
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
            const maxAge = this.timeHelpers.isWithinOperatingHours()
                ? config.api.minStaticDataFreshness || 300000  // 5 minutes during operations
                : 86400000; // 24 hours during off-hours

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

    _processData(rawData) {
        return this.statusProcessor
            ? this.statusProcessor.processRawAPIData(rawData)
            : this._basicProcessData(rawData);
    }

    _basicProcessData(rawData) {
        const processed = {
            network: {
                status: this.timeHelpers.isWithinOperatingHours() ? 'operational' : 'closed',
                timestamp: new Date().toISOString()
            },
            lines: Object.fromEntries(
                Object.entries(rawData.lineas || {})
                    .filter(([k]) => k.startsWith('l'))
                    .map(([lineId, lineData]) => [
                        lineId,
                        {
                            id: lineId,
                            status: lineData.estado,
                            message: lineData.mensaje,
                            message_app: lineData.mensaje_app,
                            stations: lineData.estaciones?.map(station => ({
                                id: station.codigo,
                                name: station.nombre,
                                status: station.estado,
                                description: station.descripcion,
                                description_app: station.descripcion_app,
                                transfer: station.combinacion || '',
                                ...(station.isTransferOperational !== undefined && { 
                                    isTransferOperational: station.isTransferOperational 
                                }),
                                ...(station.accessPointsOperational !== undefined && { 
                                    accessPointsOperational: station.accessPointsOperational 
                                })
                            })) || []
                        }
                    ])
            ),
            stations: {},
            version: this._dataVersion,
            lastUpdated: new Date().toISOString(),
            _metadata: {
                source: 'generated',
                timestamp: new Date(),
                generation: 'basic'
            }
        };

        // Store the processed data immediately
        this._updateProcessedData(processed);
        return processed;
    }

    _handleDataChanges(rawData, processedData) {
        const changeResult = this.changeDetector.analyze(rawData, this.lastRawData);
        if (changeResult.changes?.length > 0) {
            this.changeHistory.unshift(...changeResult.changes);
            this.metrics.changeEvents += changeResult.changes.length;
            this._emitChanges(changeResult, processedData);
        }
    }

    async _checkForNewsUpdates() {
        this.metrics.newsChecks++;
        const newsResult = await this.newsService.checkNews();
        if (newsResult?.posted) {
            this.metrics.newsPosted += newsResult.posted;
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
        const payload = new EventPayload(
            EventRegistry.RAW_DATA_FETCHED,
            Object.freeze({...rawData}),
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
            if (typeof change === 'string') {
                return {
                    id: change,
                    name: 'unknown', 
                    lineId: 'unknown', 
                    type: 'unknown',
                    from: 'unknown',
                    to: 'unknown',
                    severity: 'none'
                };
            }
            
            return {
                type: change.type,
                id: change.id || String(change.line || change.stationId || 'unknown'),
                name: change.name,
                line: change.line,
                from: String(change.from || change.fromState || 'unknown'),
                to: String(change.to || change.toState || 'unknown'),
                ...(change.description && { description: String(change.description) }),
                ...(change.timestamp && { timestamp: new Date(change.timestamp).toISOString() }),
                severity: ['critical','high','medium','low','none'].includes(change.severity) 
                    ? change.severity 
                    : 'none'
            };
        }).filter(change => change.id && change.type && change.from && change.to);

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
            newsMetrics: {
                checks: this.metrics.newsChecks,
                posted: this.metrics.newsPosted,
                lastPosted: this.newsService.getLastPosted()
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
            overridesActive: Object.values(this.override.getOverrides().lines).some(o => o.enabled) || 
                           Object.values(this.override.getOverrides().stations).some(o => o.enabled),
            newsService: this.newsService.getStatus(),
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
        this.newsService.cleanup();
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


    async checkNews() {
        this.metrics.newsChecks++;
        try {
            const result = await this.newsService.checkNews();
            if (result?.posted) {
                this.metrics.newsPosted += result.posted;
            }
            return { 
                success: true, 
                posted: result?.posted || 0,
                timestamp: new Date() 
            };
        } catch (error) {
            logger.error('[ApiService] News check failed:', error);
            return { success: false, error: error.message };
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

}

module.exports = ApiService;
