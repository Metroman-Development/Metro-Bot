// modules/status/UpdateListener.js
const EventEmitter = require('events');
const EventRegistry = require('../../../core/EventRegistry');
const EventPayload = require('../../../core/EventPayload');
const { performance } = require('perf_hooks');
const logger = require('../../../events/logger');
const Bottleneck = require('bottleneck');
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
            
            this.setupEventListeners();
            await this._waitForEmbedsReady();
            
            this._initialLoadComplete = true;
            await this.parent.processor.processPendingUpdates();
            
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
                    pendingUpdates: this._pendingUpdates.size
                }
            });
            this._handleCriticalFailure(error);
        }
    }

    async _waitForEmbedsReady() {
        const MAX_WAIT_TIME = 30000;
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

    /*======================*/
    /*  LISTENER SETUP      */
    /*======================*/

    setupEventListeners() {
        if (this._shuttingDown) {
            logger.warn('[UpdateListener] Skipping listener setup during shutdown');
            return;
        }
        
        logger.debug('[UpdateListener] Beginning event listener setup');
        this._cleanupEventListeners();
        
        this._setupMetroCoreListeners();
        this._setupDataManagerListeners();
        this._setupSystemListeners();
        this._setupTimeEventListeners();
        this._setupEmbedListeners();
        
        logger.debug('[UpdateListener] Event listeners setup complete', {
            listenerCounts: this._countActiveListeners(),
            memoryUsage: process.memoryUsage().rss
        });
    }

    _setupMetroCoreListeners() {
        // This is now handled by bootstrap and other services
    }

    _setupDataManagerListeners() {
        // This is now handled by bootstrap and other services
    }

    _setupSystemListeners() {
        this.parent.on(EventRegistry.ERROR, (payload) => {
            if (!this._validatePayload(payload, EventRegistry.ERROR)) return;
            
            this.consecutiveErrors++;
            logger.warn('[UpdateListener] System error', {
                error: payload.data.error.message,
                source: payload.metadata.source,
                consecutiveErrors: this.consecutiveErrors
            });
            
            if (this.consecutiveErrors > 5) {
                this.parent.emit(EventRegistry.FATAL_ERROR, 
                    new EventPayload(
                        EventRegistry.FATAL_ERROR,
                        new Error('Too many consecutive errors'),
                        { source: 'UpdateListener' }
                    )
                );
            }
        });

        this.parent.on(EventRegistry.UPDATE_COMPLETED, () => {
            this.consecutiveErrors = 0;
            this.emit(EventRegistry.STATS_UPDATE, 
                new EventPayload(
                    EventRegistry.STATS_UPDATE,
                    this._getPerformanceStats(),
                    { source: 'UpdateListener' }
                )
            );
        });

        process.on('warning', (warning) => {
            if (warning.name === 'MaxListenersExceededWarning') {
                this._handleMemoryPressure(warning);
            }
        });
    }

    _setupTimeEventListeners() {
        // This is now handled by bootstrap and other services
    }
    
    
    _getRefreshPriority(level) {
    const priorityMap = {
        high: this.parent.processor.PRIORITY_LEVELS.CRITICAL,
        normal: this.parent.processor.PRIORITY_LEVELS.HIGH, 
        low: this.parent.processor.PRIORITY_LEVELS.NORMAL
    };
    return priorityMap[level] || this.parent.processor.PRIORITY_LEVELS.NORMAL;
}

    _setupEmbedListeners() {
        this.parent.on(EventRegistry.EMBEDS_READY, () => {
            this.listenerReady = true;
            this._isFirst = false;
        });

        this.parent.on(EventRegistry.EMBEDS_UPDATED, () => {
            this.emit(EventRegistry.UPDATE_COMPLETED);
        });
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
    }

    _setupDiagnostics() {
        this.diagnosticInterval = setInterval(() => {
            this.emit(EventRegistry.DIAGNOSTICS,
                new EventPayload(
                    EventRegistry.DIAGNOSTICS,
                    this._getPerformanceStats(),
                    { source: 'UpdateListener' }
                )
            );
        }, 30000).unref();
    }

    _setupMemoryWatchdog() {
        this.memoryWatchdog = setInterval(() => {
            const memory = process.memoryUsage();
            if (memory.rss > 800 * 1024 * 1024) {
                this._handleMemoryPressure({
                    name: 'HighMemoryUsage',
                    message: `Memory usage high: ${Math.round(memory.rss / (1024 * 1024))}MB`
                });
            }
        }, 60000).unref();
    }

    _cleanupEventListeners() {
        // MetroCore listeners are removed
        
        // System listeners
        this.parent.removeAllListeners(EventRegistry.ERROR);
        this.parent.removeAllListeners(EventRegistry.UPDATE_COMPLETED);
        
        // Embed listeners
        this.parent.removeAllListeners(EventRegistry.EMBEDS_READY);
        this.parent.removeAllListeners(EventRegistry.EMBEDS_UPDATED);
    }

    /*======================*/
    /*  EVENT HANDLING      */
    /*======================*/

    async _trackEventTiming(eventType, handler) {
        if (this._shuttingDown) return;
        
        const start = performance.now();
        try {
            await this.rateLimiter.schedule(handler);
            const duration = performance.now() - start;
            
            this.eventTimings.set(eventType, {
                lastDuration: duration,
                timestamp: Date.now(),
                success: true
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
        return payload?.type === expectedType;
    }

    _handleHandlerError(eventType, error) {
        logger.error(`[UpdateListener] Error processing ${eventType}`, error);
        this.emit(EventRegistry.ERROR,
            new EventPayload(
                EventRegistry.ERROR,
                { error, context: { eventType } },
                { source: `UpdateListener.${eventType}` }
            )
        );
        
        if (this.consecutiveErrors++ > 3) {
            this._enterRecoveryMode();
        }
    }

    _handleApiHealthChange(status) {
        this.rateLimiter.updateSettings({
            minTime: status.health === 'degraded' ? 500 : 100
        });
    }

    _enterRecoveryMode() {
        logger.warn('[UpdateListener] Entering recovery mode');
        this.parent.processor.pause();
        this._cleanupEventListeners();
        
        setTimeout(() => {
            try {
                this.setupEventListeners();
                this.parent.processor.resume();
            } catch (error) {
                this._handleCriticalFailure(error);
            }
        }, 5000);
    }

    _handleCriticalFailure(error) {
        this._shuttingDown = true;
        this._cleanupEventListeners();
        this.rateLimiter.stop();
        
        this.parent.emit(EventRegistry.FATAL_ERROR,
            new EventPayload(
                EventRegistry.FATAL_ERROR,
                error,
                { source: 'UpdateListener' }
            )
        );
    }

    _handleMemoryPressure(warning) {
        this._cleanupEventListeners();
        this.setupEventListeners();
        
        if (global.gc) {
            setImmediate(global.gc);
        }
    }

    /*======================*/
    /*  DIAGNOSTICS         */
    /*======================*/

    _getPerformanceStats() {
        return {
            uptime: process.uptime(),
            eventTimings: Array.from(this.eventTimings.entries()),
            errorRate: this.consecutiveErrors,
            memoryUsage: process.memoryUsage(),
            listenerCounts: this._countActiveListeners(),
            lastUpdated: new Date().toISOString()
        };
    }

    _countActiveListeners() {
        return {
            internal: this.eventNames().length
        };
    }

    /*======================*/
    /*  PUBLIC API          */
    /*======================*/

    async safeShutdown() {
        this._shuttingDown = true;
        clearInterval(this.diagnosticInterval);
        clearInterval(this.memoryWatchdog);
        
        this._cleanupEventListeners();
        await this.rateLimiter.stop({ dropWaitingJobs: false });
    }

    getStatus() {
        return {
            initialized: !this._shuttingDown,
            operational: this.consecutiveErrors < 3,
            embedsReady: this.parent.embeds?.areEmbedsReady
        };
    }
}

module.exports = UpdateListener;