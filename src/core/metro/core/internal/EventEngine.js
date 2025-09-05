const EventRegistry = require('../../../../core/EventRegistry');
const EventPayload = require('../../../../core/EventPayload');
const logger = require('../../../../events/logger');

class EventEngine {
    constructor(metro) {
        this.metro = metro;
        this._backpressure = false;
        this._consecutiveErrors = 0;
        this._listenerCounts = new Map();
    }

    setupListeners() {
        this.metro._removeAllListeners();

    // DataManager Service Events (primary source of changes)
    this.metro._subsystems.dataManager
        .on(EventRegistry.RAW_DATA_FETCHED, (payload) => { // Renamed to payload
            if (!payload || !payload.data) {
                this.emitError('RAW_DATA_FETCHED', new Error('Invalid or empty payload received'));
                return;
            }
            this.metro._handleRawData(payload.data).catch(error => {
                this.emitError('RAW_DATA_FETCHED', error, { rawData: payload.data });
            });
        })
        .on(EventRegistry.FETCH_COMPLETE, () => {
            this.safeEmit(EventRegistry.API_READY, { 
                timestamp: Date.now() 
            }, { source: 'ApiService' });
        })
        .on(EventRegistry.CHANGES_DETECTED, (changes) => {
            if (!changes || typeof changes !== 'object') {
                return this.emitError('CHANGES_DETECTED', 
                    new Error('Invalid changes object'));
            }
            
            const announcements = this.metro._subsystems.changeAnnouncer.generateMessages(changes);
            this.safeEmit(EventRegistry.SYSTEM_CHANGES, { 
                changes, 
                announcements 
            }, { 
                severity: changes.metadata?.severity || 'normal' 
            });
        });

    this.metro._subsystems.accessibilityService
        .on(EventRegistry.ACCESSIBILITY_CHANGE, (payload) => {
            if (!payload || !payload.data || !payload.data.changes) {
                return this.emitError('ACCESSIBILITY_CHANGE', new Error('Invalid accessibility change payload'));
            }
            const { changes } = payload.data;
            const announcements = this.metro._subsystems.changeAnnouncer.generateMessages(changes);
            this.safeEmit(EventRegistry.SYSTEM_CHANGES, {
                changes,
                announcements
            }, {
                severity: 'medium' // Accessibility changes are medium severity
            });
        });

    // Error Handling (keep this part)
    this.metro.on(EventRegistry.ERROR, (payload) => {
        if (!payload || !payload.validate()) {
            logger.error('Received invalid error payload', {
                payload: payload?.sanitizedData?.()
            });
            return;
        }

        if (this._consecutiveErrors++ > 5) {
            this.metro._enterSafeMode();
        }

        this.metro._subsystems.statusService._logChange(
            'system',
            'error',
            this.metro._subsystems.statusService.state.network,
            this.metro._subsystems.statusService._createNetworkStatus('4', 'major_outage', 'critical')
        );
    });
}

removeAllListeners() {
    const removalStats = {
        core: 0,
        subsystems: {
                dataManager: 0,
            statusService: 0,
            scheduler: 0
        },
        timestamp: new Date().toISOString()
    };

    try {
        removalStats.core = this.metro.eventNames().length;
        this.metro.removeAllListeners();
        
        if (this.metro._subsystems?.dataManager) {
            removalStats.subsystems.dataManager = this.metro._subsystems.dataManager.eventNames().length;
            this.metro._subsystems.dataManager.removeAllListeners();
        }

        if (this.metro._subsystems?.statusService) {
            removalStats.subsystems.statusService = this.metro._subsystems.statusService.eventNames().length;
            this.metro._subsystems.statusService.removeAllListeners();
        }

        if (this.metro._scheduler) {
            removalStats.subsystems.scheduler = this.metro._scheduler.eventNames().length;
            this.metro._scheduler.removeAllListeners();
        }

        logger.debug('[MetroCore] Listeners removed', removalStats);
        return removalStats;
    } catch (error) {
        logger.error('[MetroCore] Listener cleanup failed', {
            error: error.message,
            stack: error.stack,
            partialStats: removalStats
        });
        throw new Error(`Partial listener cleanup: ${error.message}`);
    }
}

    safeEmit(event, data = {}, metadata = {}) {
        try {
            if (!Object.values(EventRegistry).includes(event)) {
                throw new Error(`Event ${event} not registered`);
            }

            if (typeof data !== 'object' || data === null) {
                data = { value: data };
            }

            const payload = new EventPayload(event, data, {
                source: 'MetroCore',
                timestamp: Date.now(),
                ...metadata
            });

            if (!payload.validate()) {
                throw new Error(`Invalid payload: ${payload.errors.join(', ')}`);
            }

            return this.metro.emit(event, payload);
        } catch (error) {
            logger.error(`[MetroCore] Failed to emit ${event}`, {
                error: error.message,
                stack: error.stack,
                originalData: data
            });
            return false;
        }
    }

    emitError(context, error, extraData = {}) {
        const payload = new EventPayload(
            EventRegistry.ERROR,
            { error, ...extraData },
            { 
                source: `MetroCore.${context}`,
                stack: error.stack 
            }
        );
        
        if (!payload.validate()) {
            logger.error('Failed to construct valid error payload', payload.errors);
            return;
        }

        this.metro.emit(EventRegistry.ERROR, payload);
    }

    _updateListenerStats(event) {
        const count = this.metro.listenerCount(event);
        this._listenerCounts.set(event, {
            count,
            lastUpdated: Date.now()
        });
    }

    _checkBackpressure() {
        const totalListeners = [...this._listenerCounts.values()]
            .reduce((sum, stats) => sum + stats.count, 0);
        
        this._backpressure = totalListeners > 25;
        if (this._backpressure) {
            logger.warn(`Backpressure activated (${totalListeners} listeners)`);
        }
    }

    
}

module.exports = EventEngine;