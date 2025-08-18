// modules/status/UpdateListener.js
// modules/status/UpdateListener.js
// modules/status/UpdateListener.js
// modules/status/UpdateListener.js
// modules/status/UpdateListener.js
const EventEmitter = require('events');
const EventRegistry = require('../../../core/EventRegistry');
const EventPayload = require('../../../core/EventPayload');
const { performance } = require('perf_hooks');
const logger = require('../../../events/logger');
const Bottleneck = require('bottleneck');
const { setImmediate } = require('timers');
const moment = require('moment');

class UpdateListener extends EventEmitter {
    constructor(statusUpdater) {
        super();
        
        if (!statusUpdater) throw new Error('StatusUpdater instance required');
        
        this.parent = statusUpdater;
        this.consecutiveErrors = 0;
        this.eventTimings = new Map();
        this._shuttingDown = false;
        this._isFirst = true;
        this.listenerReady = false;
        this._pendingUpdates = new Map();
        this._updateQueue = [];
        this._isProcessingQueue = false;
        this._initialLoadComplete = false;
        
        this._setupRateLimiter();
        this._setupDiagnostics();
        this._setupMemoryWatchdog();
        
        this.setMaxListeners(50);
        logger.debug('[UpdateListener] Instance initialized', {
            firstRun: this._isFirst
        });
    }

    /*======================*/
    /*  CORE INITIALIZATION */
    /*======================*/

    async initialize() {
        try {
            logger.debug('[UpdateListener] Starting initialization sequence');
            
            // Phase 1: Setup core event listeners
            this.setupEventListeners();
            
            // Phase 2: Wait for embeds to be ready
            await this._waitForEmbedsReady();
            
            // Phase 3: Process any pending updates
            this._initialLoadComplete = true;
            await this._processPendingUpdates();
            
            logger.info('[UpdateListener] Initialization complete');
            this.emit(EventRegistry.LISTENER_READY, 
                new EventPayload(
                    EventRegistry.LISTENER_READY,
                    { timestamp: Date.now() },
                    { source: 'UpdateListener' }
                )
            );
        } catch (error) {
            logger.fatal('[UpdateListener] Initialization failed', {
                error: error.message,
                stack: error.stack,
                currentState: {
                    embedsReady: this.parent.embeds?.areEmbedsReady,
                    pendingUpdates: this._pendingUpdates.size,
                    queueLength: this._updateQueue.length
                }
            });
            this._handleCriticalFailure(error);
        }
    }

    async _waitForEmbedsReady() {
        const MAX_WAIT_TIME = 30000; // 30 seconds
        const startTime = Date.now();
        
        return new Promise((resolve, reject) => {
            const checkReady = () => {
                if (this.parent.embeds?.areEmbedsReady) {
                    logger.debug('[UpdateListener] Embeds ready');
                    this._isFirst = true;
                    resolve();
                } else if (Date.now() - startTime > MAX_WAIT_TIME) {
                    reject(new Error('EmbedManager did not become ready within timeout'));
                } else {
                    setTimeout(checkReady, 100);
                }
            };
            checkReady();
        });
    }

    _isInitialDataLoaded() {
        return this.parent.metroCore._combinedData &&
               Object.keys(this.parent.metroCore._combinedData.stations).length > 0;
    }

    /*======================*/
    /*  LISTENER SETUP      */
    /*======================*/

    setupEventListeners() {
        if (this._shuttingDown) {
            logger.warn('[UpdateListener] Skipping listener setup during shutdown');
            return;
        }
        
        logger.debug('[UpdateListener] Beginning event listener setup');
        
        // Clean up existing listeners first
        this._cleanupEventListeners();
        
        // 1. MetroCore Data Events
        this._setupMetroCoreListeners();
        
        // 2. API Service Events
        this._setupApiServiceListeners();
        
        // 3. System Health Events
        this._setupSystemListeners();
        
        logger.debug('[UpdateListener] Event listeners setup complete', {
            listenerCounts: this._countActiveListeners(),
            memoryUsage: process.memoryUsage().rss
        });
    }

    _setupMetroCoreListeners() {
        // Data Updates
        this.parent.metroCore._subsystems.api.on(EventRegistry.RAW_DATA_FETCHED, async (payload) => {
            await this._trackEventTiming('RAW_DATA_FETCHED', async () => {
                if (!this._validatePayload(payload, EventRegistry.RAW_DATA_FETCHED)) return;
                
                logger.debug('[UpdateListener] Handling raw data', {
                    isFirst: this._isFirst,
                    source: payload.metadata?.source,
                    listenerReady: this.listenerReady
                });
            });
        });

        this.parent.metroCore.on(EventRegistry.DATA_UPDATED, async (payload) => {
            await this.parent.resetMetroCore();
            await this._trackEventTiming('DATA_UPDATED', async () => {
                if (!this._validatePayload(payload, EventRegistry.DATA_UPDATED)) return;
                
                logger.debug('[UpdateListener] Handling data update', {
                    version: payload.data.version,
                    source: payload.metadata.source
                });
                
                if (!this._initialLoadComplete) {
                    this._pendingUpdates.set('initial_data', payload.data);
                    return;
                }
                
                await this._enqueueUpdate({
                    type: 'full',
                    data: payload.data,
                    priority: 1
                });
            });
        });

        // Service Changes
        this.parent.metroCore.on(EventRegistry.SERVICE_CHANGE, (payload) => {
            this._trackEventTiming('SERVICE_CHANGE', () => {
                if (!this._validatePayload(payload, EventRegistry.SERVICE_CHANGE)) return;
                
                logger.debug('[UpdateListener] Handling service change', {
                    type: payload.data.type,
                    dayType: payload.data.systemState.dayType
                });
                
                this.parent.processor.queueUpdate('service', payload.data);
            });
        });

        // Express Updates
        this.parent.metroCore.on(EventRegistry.EXPRESS_UPDATE, (payload) => {
            this._trackEventTiming('EXPRESS_UPDATE', () => {
                if (!this._validatePayload(payload, EventRegistry.EXPRESS_UPDATE)) return;
                
                logger.debug('[UpdateListener] Handling express update', {
                    lines: payload.data.context.affectedLines.length,
                    period: payload.data.context.period
                });
                
                this.parent.processor.queueUpdate('express', payload.data);
            });
        });

        // Special Events
        this.parent.metroCore.on(EventRegistry.SPECIAL_EVENT, (payload) => {
            this._trackEventTiming('SPECIAL_EVENT', () => {
                if (!this._validatePayload(payload, EventRegistry.SPECIAL_EVENT)) return;
                
                logger.debug('[UpdateListener] Handling special event', {
                    eventType: payload.data.type,
                    impactLevel: payload.data.impact.level
                });
                
                this.parent.processor.queueUpdate('event', payload.data);
            });
        });
    }

    _setupApiServiceListeners() {
        // Changes Detected (Primary Update Trigger)
        this.parent.metroCore._subsystems.api.on(EventRegistry.CHANGES_DETECTED, async (payload) => {
            const startTime = performance.now();
            
            await this._trackEventTiming('CHANGES_DETECTED', async () => {
                if (!this._validatePayload(payload, EventRegistry.CHANGES_DETECTED)) return;
                
                logger.debug('[UpdateListener] Handling changes', {
                    changeCount: payload.data.changes.length,
                    isFirstRun: this._isFirst,
                    listenerReady: this.listenerReady,
                    source: payload.metadata?.source
                });
                
                if (0 === 1) {
                    logger.debug('[UpdateListener] Skipping changes - ' + 
                        (this._isFirst ? 'first run in progress' : 'listener not ready'));
                    return;
                }
                
                const { changes, allStations } = payload.data;
                const affectedLines = new Set();
                const lineChanges = [];
                const stationChanges = [];
                
                await this.parent.processor.processChanges(payload.data);
                
                // 1. Categorize changes
                changes.forEach(change => {
                    if (change.type === 'line') {
                        affectedLines.add(change.id);
                        lineChanges.push(change);
                    } else if (change.type === 'station') {
                        affectedLines.add(change.line);
                        stationChanges.push(change);
                    }
                });
                
                // 2. Get current data state
                const currentData = (await this.parent.metroCore.getCurrentData()) || {
                    lines: allStations?.lines || {},
                    stations: allStations?.stations || {}
                };
                
                try {
                    // 3. Update overview embed
                    logger.debug('[UpdateListener] Updating overview with line changes', {
                        lineChangeCount: lineChanges.length
                    });
                    await this.parent.embeds.updateOverviewEmbed(
                        this.parent.processor._getNetworkStatus(currentData),
                        { changes: lineChanges }
                    );
                    
                    // 4. Update affected line embeds
                    if (affectedLines.size > 0) {
                        logger.debug('[UpdateListener] Updating affected lines', {
                            lineCount: affectedLines.size,
                            lines: Array.from(affectedLines)
                        });
                        
                        const BATCH_SIZE = 3;
                        const lineArray = Array.from(affectedLines);
                        
                        for (let i = 0; i < lineArray.length; i += BATCH_SIZE) {
                            const batch = lineArray.slice(i, i + BATCH_SIZE);
                            await Promise.all(batch.map(lineId => 
                                this.parent.embeds.updateLineEmbed({
                                    ...currentData.lines[lineId],
                                    _allStations: currentData.stations
                                })))
                            
                            
                            if (i + BATCH_SIZE < lineArray.length) {
                                await new Promise(resolve => setTimeout(resolve, 500));
                            }
                        }
                    }
                    
                    logger.info('[UpdateListener] Changes processed successfully', {
                        totalChanges: changes.length,
                        affectedLines: affectedLines.size,
                        duration: `${performance.now() - startTime}ms`
                    });
                } catch (error) {
                    logger.error('[UpdateListener] Failed to process changes', {
                        error: error.message,
                        stack: error.stack,
                        failedAt: error.stack?.split('\n')[0] || 'unknown',
                        changesProcessed: lineChanges.length + stationChanges.length
                    });
                    throw error;
                }
            });
        });

        // API Health Events
        this.parent.metroCore._subsystems.api.on(EventRegistry.API_HEALTH_UPDATE, (status) => {
            this._handleApiHealthChange(status);
        });
    }

    _setupSystemListeners() {
        // Error Handling
        this.parent.on(EventRegistry.ERROR, (payload) => {
            if (!this._validatePayload(payload, EventRegistry.ERROR)) return;
            
            this.consecutiveErrors++;
            const errorContext = {
                error: payload.data.error.message,
                source: payload.metadata.source,
                stack: payload.data.error.stack,
                consecutiveErrors: this.consecutiveErrors
            };
            
            logger.warn('[UpdateListener] System error', errorContext);
            if (this.consecutiveErrors > 5) {
                logger.fatal('[UpdateListener] Consecutive error threshold exceeded');
                this.parent.emit(EventRegistry.FATAL_ERROR, 
                    new EventPayload(
                        EventRegistry.FATAL_ERROR,
                        new Error('Too many consecutive errors'),
                        { source: 'UpdateListener' }
                    )
                );
            }
        });

        // Time-Based Events Distribution
        this._setupTimeEventListeners();

        // Update Completion
        this.parent.on(EventRegistry.UPDATE_COMPLETED, () => {
            logger.debug('[UpdateListener] Update completed, resetting error counter');
            this.consecutiveErrors = 0;
            this.emit(EventRegistry.STATS_UPDATE, 
                new EventPayload(
                    EventRegistry.STATS_UPDATE,
                    this._getPerformanceStats(),
                    { source: 'UpdateListener' }
                )
            );
        });

        // Memory Pressure
        process.on('warning', (warning) => {
            if (warning.name === 'MaxListenersExceededWarning') {
                this._handleMemoryPressure(warning);
            }
        });
    }

    _setupTimeEventListeners() {
        // Service Transition
        this.parent.metroCore.api.timeAwaiter.on(EventRegistry.SERVICE_TRANSITION, (payload) => {
            this._trackEventTiming('SERVICE_TRANSITION', async () => {
                if (!this._validatePayload(payload, EventRegistry.SERVICE_TRANSITION)) return;
                
                logger.debug('[UpdateListener] Handling service transition', {
                    type: payload.data.type,
                    isExtended: payload.data.isExtended
                });
                
                // Distribute to announcement system
                await this.parent.announcementHandler.handleTimeEvent(payload);
                
                // Queue for processing
                this.parent.processor.queueUpdate('service', {
                    type: payload.data.isExtended ? 'extended' : 'normal',
                    dayType: this.parent.timeHelpers.getDayType(),
                    systemState: {
                        period: this.parent.timeHelpers.getCurrentPeriod().name,
                        nextTransition: payload.data.nextTransition
                    }
                });
            });
        });

        // Express Service Change
        this.parent.metroCore.api.timeAwaiter.on(EventRegistry.EXPRESS_CHANGE, (payload) => {
            this._trackEventTiming('EXPRESS_CHANGE', async () => {
                if (!this._validatePayload(payload, EventRegistry.EXPRESS_CHANGE)) return;
                
                logger.debug('[UpdateListener] Handling express service change', {
                    active: payload.data.active,
                    period: payload.data.period.name
                });
                
                // Distribute to announcement system
                await this.parent.announcementHandler.handleTimeEvent(payload);
                
                // Queue for processing
                this.parent.processor.queueUpdate('express', {
                    active: payload.data.active,
                    period: payload.data.period,
                    remainingDuration: this._calculateRemainingDuration(payload)
                });
            });
        });

        // Day Type Change
        this.parent.metroCore.api.timeAwaiter.on(EventRegistry.DAY_TYPE_CHANGE, (payload) => {
            this._trackEventTiming('DAY_TYPE_CHANGE', async () => {
                if (!this._validatePayload(payload, EventRegistry.DAY_TYPE_CHANGE)) return;
                
                logger.debug('[UpdateListener] Handling day type change', {
                    dayType: payload.data.dayType
                });
                
                // Distribute to announcement system
                await this.parent.announcementHandler.handleTimeEvent(payload);
            });
        });

        // Fare Period Change
        this.parent.metroCore.api.timeAwaiter.on(EventRegistry.FARE_PERIOD_CHANGE, (payload) => {
            this._trackEventTiming('FARE_PERIOD_CHANGE', async () => {
                if (!this._validatePayload(payload, EventRegistry.FARE_PERIOD_CHANGE)) return;
                
                logger.debug('[UpdateListener] Handling fare period change', {
                    periodType: payload.data.periodType
                });
                
                // Distribute to announcement system
                await this.parent.announcementHandler.handleTimeEvent(payload);
            });
        });
    }

    _calculateRemainingDuration(payload) {
        const now = this.parent.timeHelpers.currentTime;
        const endTime = payload.data.period.end || '19:30';
        return this.parent.timeHelpers.formatDuration(
            moment(endTime, 'HH:mm').diff(now)
        );
    }

    /*======================*/
    /*  UPDATE PROCESSING   */
    /*======================*/

    async _enqueueUpdate(update) {
        this._updateQueue.push(update);
        this._updateQueue.sort((a, b) => b.priority - a.priority); // Higher priority first
        
        logger.debug('[UpdateListener] Update enqueued', {
            type: update.type,
            priority: update.priority,
            queueLength: this._updateQueue.length
        });
        
        if (!this._isProcessingQueue) {
            setImmediate(() => this._processUpdateQueue());
        }
    }

    async _processUpdateQueue() {
        if (this._isProcessingQueue || this._updateQueue.length === 0) return;
        
        this._isProcessingQueue = true;
        try {
            while (this._updateQueue.length > 0 && !this._shuttingDown) {
                const update = this._updateQueue.shift();
                try {
                    switch (update.type) {
                        case 'full':
                            await this._handleFullUpdate(update.data);
                            break;
                        case 'changes':
                            await this._handleChangesUpdate(update.changes, update.currentData);
                            break;
                    }
                } catch (error) {
                    logger.error('[UpdateListener] Failed to process update', {
                        type: update.type,
                        error: error.message,
                        stack: error.stack
                    });
                }
                
                // Rate limiting between updates
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        } finally {
            this._isProcessingQueue = false;
        }
    }

    async _handleFullUpdate(data) {
        logger.debug('[UpdateListener] Processing full update');
        await this.parent.embeds.updateAllEmbeds(data);
    }

    async _handleChangesUpdate(changes, currentData) {
        logger.debug('[UpdateListener] Processing changes update', {
            changeCount: changes.length
        });
        
        // Determine affected lines
        const affectedLines = new Set();
        const lineChanges = [];
        
        changes.forEach(change => {
            if (change.type === 'line') {
                affectedLines.add(change.id);
                lineChanges.push(change);
            } else if (change.type === 'station') {
                affectedLines.add(change.line);
            }
        });
        
        // Update overview with line changes only
        await this.parent.embeds.updateOverviewEmbed(
            this.parent.processor._getNetworkStatus(currentData),
            { changes: lineChanges }
        );
        
        // Update affected line embeds
        await Promise.all(
            Array.from(affectedLines).map(lineId => 
                this.parent.embeds.updateLineEmbed({
                    ...currentData.lines[lineId],
                    _allStations: currentData.stations
                })
            )
        );
    }

    async _processPendingUpdates() {
        if (this._pendingUpdates.size === 0) return;
        
        logger.debug('[UpdateListener] Processing pending updates', {
            count: this._pendingUpdates.size
        });
        
        // Process initial data first
        if (this._pendingUpdates.has('initial_data')) {
            const data = this._pendingUpdates.get('initial_data');
            await this._handleFullUpdate(data);
            this._pendingUpdates.delete('initial_data');
        }
        
        // Process batch changes
        if (this._pendingUpdates.has('batch_changes')) {
            const { changes, allStations } = this._pendingUpdates.get('batch_changes');
            await this._handleChangesUpdate(changes, allStations);
            this._pendingUpdates.delete('batch_changes');
        }
    }

    /*======================*/
    /*  SYSTEM MANAGEMENT   */
    /*======================*/

    _setupRateLimiter() {
        this.rateLimiter = new Bottleneck({
            minTime: 100,
            maxConcurrent: 5,
            highWater: 50,
            strategy: Bottleneck.strategy.BLOCK,
            id: 'update-processor',
            timeout: 30000
        });
        
        this.rateLimiter.on('error', (error) => {
            logger.error('[UpdateListener] Rate limiter error', error);
            this._handleCriticalFailure(error);
        });
        
        logger.debug('[UpdateListener] Rate limiter initialized');
    }

    _setupDiagnostics() {
        this.diagnosticInterval = setInterval(() => {
            const stats = this._getPerformanceStats();
            this.emit(EventRegistry.DIAGNOSTICS,
                new EventPayload(
                    EventRegistry.DIAGNOSTICS,
                    stats,
                    { source: 'UpdateListener' }
                )
            );
        }, 30000).unref();
    }

    _setupMemoryWatchdog() {
        this.memoryWatchdog = setInterval(() => {
            const memory = process.memoryUsage();
            if (memory.rss > 800 * 1024 * 1024) { // 800MB
                this._handleMemoryPressure({
                    name: 'HighMemoryUsage',
                    message: `Memory usage high: ${Math.round(memory.rss / (1024 * 1024))}MB`
                });
            }
        }, 60000).unref();
    }

    _cleanupEventListeners() {
        // MetroCore listeners
        this.parent.metroCore.removeAllListeners(EventRegistry.DATA_UPDATED);
        this.parent.metroCore.removeAllListeners(EventRegistry.SERVICE_CHANGE);
        this.parent.metroCore.removeAllListeners(EventRegistry.EXPRESS_UPDATE);
        this.parent.metroCore.removeAllListeners(EventRegistry.SPECIAL_EVENT);
        
        // API Service listeners
        this.parent.metroCore._subsystems.api.removeAllListeners(EventRegistry.CHANGES_DETECTED);
        this.parent.metroCore._subsystems.api.removeAllListeners(EventRegistry.API_HEALTH_UPDATE);
        
        // System listeners
        this.parent.removeAllListeners(EventRegistry.ERROR);
        this.parent.removeAllListeners(EventRegistry.UPDATE_COMPLETED);
        
        // Time-based event listeners
        this.parent.removeAllListeners(EventRegistry.SERVICE_TRANSITION);
        this.parent.removeAllListeners(EventRegistry.EXPRESS_CHANGE);
        this.parent.removeAllListeners(EventRegistry.DAY_TYPE_CHANGE);
        this.parent.removeAllListeners(EventRegistry.FARE_PERIOD_CHANGE);
        
        logger.debug('[UpdateListener] Listeners cleaned up');
    }

    /*======================*/
    /*  EVENT HANDLING      */
    /*======================*/

    async _trackEventTiming(eventType, handler) {
        if (this._shuttingDown) return;
        
        const start = performance.now();
        try {
            await this.rateLimiter.schedule(() => handler());
            const duration = performance.now() - start;
            
            this.eventTimings.set(eventType, {
                lastDuration: duration,
                timestamp: Date.now(),
                success: true
            });
            
            logger.debug(`[UpdateListener] ${eventType} processed`, {
                duration: `${duration.toFixed(2)}ms`,
                queueSize: this.rateLimiter.counts().QUEUED
            });
        } catch (error) {
            const duration = performance.now() - start;
            this.eventTimings.set(eventType, {
                lastDuration: duration,
                timestamp: Date.now(),
                success: false,
                error
            });
            this._handleHandlerError(eventType, error);
        }
    }

    _validatePayload(payload, expectedType) {
        if (!payload || typeof payload !== 'object') {
            logger.warn('[UpdateListener] Invalid payload received', {
                expectedType,
                received: typeof payload
            });
            return false;
        }
        
        if (payload.type !== expectedType) {
            logger.warn('[UpdateListener] Payload type mismatch', {
                expected: expectedType,
                received: payload.type
            });
            return false;
        }
        
        return true;
    }

    _handleHandlerError(eventType, error) {
        logger.error(`[UpdateListener] Error processing ${eventType}`, {
            error: error.message,
            stack: error.stack,
            handler: eventType
        });
        
        this.emit(EventRegistry.ERROR,
            new EventPayload(
                EventRegistry.ERROR,
                { 
                    error,
                    context: { eventType } 
                },
                { 
                    source: `UpdateListener.${eventType}`,
                    handlerError: true 
                }
            )
        );
        
        if (this.consecutiveErrors++ > 3) {
            this._enterRecoveryMode();
        }
    }

    _handleApiHealthChange(status) {
        logger.debug('[UpdateListener] API health changed', { status });
        
        // Adjust rate limiting based on API health
        if (status.health === 'degraded') {
            this.rateLimiter.updateSettings({ minTime: 500 });
        } else {
            this.rateLimiter.updateSettings({ minTime: 100 });
        }
    }

    _enterRecoveryMode() {
        if (this._shuttingDown) return;
        
        logger.warn('[UpdateListener] Entering recovery mode');
        
        // 1. Pause normal processing
        this.parent.processor.pause();
        
        // 2. Reset critical systems
        this._cleanupEventListeners();
        
        // 3. Attempt recovery
        setTimeout(() => {
            try {
                this.setupEventListeners();
                this.parent.processor.resume();
                logger.info('[UpdateListener] Recovery completed');
            } catch (error) {
                logger.fatal('[UpdateListener] Recovery failed', error);
                this._handleCriticalFailure(error);
            }
        }, 5000);
    }

    _handleCriticalFailure(error) {
        logger.fatal('[UpdateListener] Critical failure detected', error);
        this._shuttingDown = true;
        
        // Emergency cleanup
        this._cleanupEventListeners();
        this.rateLimiter.stop();
        
        // Notify parent system
        this.parent.emit(EventRegistry.FATAL_ERROR,
            new EventPayload(
                EventRegistry.FATAL_ERROR,
                error,
                { source: 'UpdateListener', critical: true }
            )
        );
    }

    _handleMemoryPressure(warning) {
        logger.warn('[UpdateListener] Memory pressure detected', {
            warning: warning.message,
            emitter: warning.emitter.constructor.name
        });
        
        // Clean up potential leaks
        this._cleanupEventListeners();
        this.setupEventListeners();
        
        // Force garbage collection if available
        if (global.gc) {
            setImmediate(() => {
                global.gc();
                logger.debug('[UpdateListener] GC forced after memory warning');
            });
        }
    }

    /*======================*/
    /*  DIAGNOSTICS         */
    /*======================*/

    _getPerformanceStats() {
        const memory = process.memoryUsage();
        const timings = Array.from(this.eventTimings.entries())
            .map(([event, stats]) => ({
                event,
                duration: stats.lastDuration,
                timestamp: stats.timestamp,
                success: stats.success
            }));
        
        return {
            uptime: process.uptime(),
            eventTimings: timings,
            errorRate: this.consecutiveErrors,
            memoryUsage: {
                rss: memory.rss,
                heapTotal: memory.heapTotal,
                heapUsed: memory.heapUsed,
                external: memory.external
            },
            queueStatus: {
                queued: this.rateLimiter.counts().QUEUED,
                running: this.rateLimiter.counts().RUNNING
            },
            listenerCounts: this._countActiveListeners(),
            lastUpdated: new Date().toISOString(),
            pendingUpdates: this._pendingUpdates?.size,
            updateQueueLength: this._updateQueue?.length
        };
    }

    _countActiveListeners() {
        const metroCoreListeners = this.parent.metroCore.eventNames()
            .map(name => ({
                event: name,
                count: this.parent.metroCore.listenerCount(name)
            }));
        
        const apiListeners = this.parent.metroCore._subsystems.api.eventNames()
            .map(name => ({
                event: name,
                count: this.parent.metroCore._subsystems.api.listenerCount(name)
            }));
        
        const internalListeners = this.eventNames()
            .map(name => ({
                event: name,
                count: this.listenerCount(name)
            }));
        
        return {
            total: metroCoreListeners.length + apiListeners.length + internalListeners.length,
            metroCore: metroCoreListeners,
            apiService: apiListeners,
            internal: internalListeners
        };
    }

    /*======================*/
    /*  PUBLIC API          */
    /*======================*/

    async safeShutdown() {
        if (this._shuttingDown) return;
        
        this._shuttingDown = true;
        logger.info('[UpdateListener] Starting graceful shutdown');
        
        // 1. Stop accepting new events
        clearInterval(this.diagnosticInterval);
        clearInterval(this.memoryWatchdog);
        
        // 2. Clean up listeners
        this._cleanupEventListeners();
        
        // 3. Drain processing queue
        try {
            await this.rateLimiter.stop({ dropWaitingJobs: false });
            logger.debug('[UpdateListener] Rate limiter drained');
        } catch (error) {
            logger.error('[UpdateListener] Error draining queue', error);
        }
        
        logger.info('[UpdateListener] Shutdown completed');
    }

    getPerformanceMetrics() {
        return this._getPerformanceStats();
    }

    getStatus() {
        return {
            initialized: !this._shuttingDown,
            operational: this.consecutiveErrors < 3,
            queueSize: this.rateLimiter.counts().QUEUED,
            lastError: this.eventTimings.get('ERROR')?.timestamp || null,
            embedsReady: this.parent.embeds?.areEmbedsReady || false,
            pendingUpdates: this._pendingUpdates.size
        };
    }
}

module.exports = UpdateListener;


