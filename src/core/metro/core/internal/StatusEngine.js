const EventRegistry = require('../../../../core/EventRegistry');
const EventPayload = require('../../../../core/EventPayload');
const logger = require('../../../../events/logger');

class StatusEngine {
    constructor(metro) {
        this.metro = metro;
        this._statusCache = new Map();
        this._safeMode = false;
        this._consecutiveErrors = 0;
    }

    enterSafeMode(reason = 'Excessive errors') {
        this._safeMode = true;
        this._consecutiveErrors = 0;

        const payload = new EventPayload(
            EventRegistry.SAFE_MODE_ACTIVATED,
            {
                reason,
                timestamp: new Date(),
                systemState: this._getSystemState()
            },
            { severity: 'critical' }
        );

        this.metro._safeEmit(EventRegistry.SAFE_MODE_ACTIVATED, payload);
        
        // Update all subsystems
        this.metro._subsystems.statusService.updateStatus('critical');
        this.metro._subsystems.api.stopPolling();
        
        logger.critical('[StatusEngine] Entered safe mode', { reason });
    }

    exitSafeMode() {
        this._safeMode = false;
        
        const payload = new EventPayload(
            EventRegistry.SAFE_MODE_EXITED,
            {
                timestamp: new Date(),
                systemState: this._getSystemState()
            },
            { source: 'StatusEngine' }
        );

        this.metro._safeEmit(EventRegistry.SAFE_MODE_EXITED, payload);
        this.metro._subsystems.api.startPolling();
    }

    _getSystemState() {
        return {
            version: this.metro._combinedData.version,
            network: this.metro._combinedData.network,
        lines: this.metro.getLineManager().getAll().map(line => ({
                id: line.id,
                status: line.status,
                stations: line.stations.length
            })),
            lastUpdated: this.metro._combinedData.lastUpdated
        };
    }

    healthCheck() {
        const state = {
            operational: !this._safeMode,
            subsystems: {
                api: this.metro._subsystems.api.getMetrics(),
                event: this._getEventSystemHealth(),
                data: {
                    lastUpdated: this.metro._combinedData.lastUpdated,
                    dataVersion: this.metro._combinedData.version
                }
            },
            errors: this._consecutiveErrors
        };

        this._statusCache.set('lastHealthCheck', {
            timestamp: new Date(),
            state
        });

        return state;
    }

    _getEventSystemHealth() {
        const counts = this.metro._engines.events._listenerCounts;
        return {
            listenerCount: [...counts.values()].reduce((sum, val) => sum + val.count, 0),
            backpressure: this.metro._engines.events._backpressure
        };
    }

    sendFullReport() {
        const report = {
            timestamp: new Date(),
            system: this._getSystemState(),
            health: this.healthCheck(),
            changes: this.metro._subsystems.api.api.changes.stats(),
            metrics: {
                api: this.metro._subsystems.api.getMetrics(),
                memory: process.memoryUsage()
            }
        };

        const payload = new EventPayload(
            EventRegistry.STATUS_REPORT,
            report,
            { source: 'StatusEngine' }
        );

        this.metro._safeEmit(EventRegistry.STATUS_REPORT, payload);
        return report;
    }

    recordError(context, error) {
        this._consecutiveErrors++;
        
        if (this._consecutiveErrors > 5 && !this._safeMode) {
            this.enterSafeMode(`Automatic safe mode: ${error.message}`);
        }

        logger.error(`[StatusEngine] Error recorded`, {
            context,
            error: error.message,
            consecutiveErrors: this._consecutiveErrors
        });
    }
}

module.exports = StatusEngine;