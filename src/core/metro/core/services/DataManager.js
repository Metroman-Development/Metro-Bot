// modules/metro/core/services/DataManager.js
const EventEmitter = require('events');
const crypto = require('crypto');
const fsp = require('fs').promises;
const path = require('path');
const { performance } = require('perf_hooks');
const TimeHelpers = require('../../../../utils/timeHelpers');
const logger = require('../../../../events/logger');
const EventRegistry = require('../../../../core/EventRegistry');
const EventPayload = require('../../../../core/EventPayload');
const config = require('../../../../config/metro/metroConfig');
const DbDataManager = require('./DbDataManager');
const { translateApiData, translateStatus } = require('../../data/DataTranslator');

class DataManager extends EventEmitter {
    constructor(options = {}, dataEngine) {
        super();

        // Core dependencies
        this.dataEngine = dataEngine;
        this.debug = options.debug || false;
        this._cycleCount = 0;
        this.checkCount = 1;

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
        this.lineInfoMap = new Map();
        this.statusMapping = null;

        // Service dependencies
        this.timeHelpers = TimeHelpers;
        this.statusProcessor = options.statusProcessor;
        this.changeDetector = options.changeDetector;

        if (!options.dbService) {
            throw new Error('[DataManager] A dbService instance is required in options.');
        }
        this.dbDataManager = new DbDataManager(options.dbService);

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


    async getCurrentData() {
        // This is a circular dependency. It should be removed.
        const MetroInfoProvider = require('../../../../utils/MetroInfoProvider');
        const metroInfoProvider = MetroInfoProvider.getInstance();
        if (metroInfoProvider) {
            return metroInfoProvider.getFullData();
        }
        logger.warn('[DataManager] MetroInfoProvider not available. Returning last known data.');
        return this.lastCurrentData;
    }

    async fetchNetworkStatus() {
        if (this.lineInfoMap.size === 0) {
            await this.dbDataManager._initializeLineMetadata();
            this.lineInfoMap = this.dbDataManager.lineInfoMap;
        }
        logger.detailed('[DataManager] Starting fetchNetworkStatus');
        if (this.isFetching) {
            logger.warn('[DataManager] Fetch already in progress. Skipping.');
            return;
        }
        this.isFetching = true;
        const requestId = crypto.randomUUID();
        this._activeRequests.add(requestId);
        this.metrics.totalRequests++;
        const startTime = performance.now();

        try {
            let currentData;
            if (this.timeHelpers.isWithinOperatingHours()) {
                logger.info('[DataManager] Within operating hours. Fetching from database.');
                currentData = await this.dbDataManager.getDbRawData();
            } else {
                logger.info('[DataManager] Outside of operating hours. Generating off-hours data.');
                currentData = await this.dbDataManager._generateOffHoursData();
            }

            currentData.version = this._dataVersion;

            const jsStatusMapping = await this.dbDataManager.dbService.getAllJsStatusMapping();
            this.statusMapping = jsStatusMapping.reduce((acc, item) => {
                acc[item.js_code] = item;
                return acc;
            }, {});

            const { lines, stations } = this._extractLineAndStationData(currentData);
            const networkSummary = this._generateNetworkSummary(lines, stations);

            const processedData = {
                ...currentData,
                lines,
                stations,
                network: networkSummary,
            };
            delete processedData.lineas;

            const finalData = await this.dataEngine.handleRawData(processedData, currentData.changeHistory);

            if (finalData) {
                this.lastRawData = currentData; // Store the original raw data
                this.lastCurrentData = finalData;
                this._updateState(finalData);
                await this._storeCurrentData(finalData);
                this.metrics.lastSuccess = new Date();
            }

            return finalData;

        } catch (error) {
            logger.error(`[DataManager] Fetch failed`, {
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

    _extractLineAndStationData(currentData) {
        const lines = currentData.lines || currentData.lineas || {};
        const stations = {};
        const sanitizedLines = {};

        for (const [lineId, line] of Object.entries(lines)) {
            if (!line || typeof line !== 'object') {
                logger.warn(`[DataManager] Skipping invalid or incomplete line object with id: ${lineId}`, { line });
                continue;
            }

            const translatedLine = translateStatus(line, this.statusMapping);

            const sanitizedLine = {
                ...translatedLine,
                id: lineId,
                displayName: line.nombre || this.lineInfoMap.get(lineId.toLowerCase()) || `Línea ${lineId.replace(/l|a/g, '')}`,
            };

            if (Array.isArray(line.estaciones)) {
                sanitizedLine.estaciones = line.estaciones.map(station => {
                    if (!station || typeof station !== 'object' || !station.codigo || !station.nombre) {
                        logger.warn(`[DataManager] Skipping invalid or incomplete station object in line ${lineId}`, { station });
                        return null;
                    }

                    const translatedStation = translateStatus(station, this.statusMapping);

                    const sanitizedStation = {
                        ...translatedStation,
                        id: station.codigo,
                        name: station.nombre,
                    };
                    stations[sanitizedStation.id] = sanitizedStation;
                    return sanitizedStation;
                }).filter(Boolean);
            } else {
                sanitizedLine.estaciones = [];
            }

            sanitizedLines[lineId] = sanitizedLine;
        }

        return { lines: sanitizedLines, stations };
    }

    _generateNetworkSummary(lines, stations) {
        const operationalLines = Object.values(lines).filter(line => line.status === 15).length;
        const withIssues = Object.values(lines).filter(line => line.status !== 15).map(line => line.id);
        let networkStatus = 'operational';
        if (withIssues.length > 0) {
            networkStatus = 'degraded';
        }
        if (operationalLines === 0 && Object.values(lines).length > 0) {
            networkStatus = 'outage';
        }

        const networkSummary = {
            status: networkStatus,
            lines: {
                total: Object.values(lines).length,
                operational: operationalLines,
                with_issues: withIssues,
            },
            stations: {
                total: Object.values(stations).length,
                operational: Object.values(stations).filter(station => station.status === 15).length,
                with_issues: Object.values(stations).filter(station => station.status !== 15).map(station => station.id),
            },
            timestamp: new Date().toISOString()
        };

        return networkSummary;
    }

    _updateCurrentData(newData) {
        const now = new Date();
        this.lastCurrentData = newData

        this.lastCurrentTimestamp = now;
        logger.debug('[DataManager] Current data updated', {
            timestamp: now.toISOString(),
            dataVersion: this._dataVersion
        });
    }

    _updateState(newData) {
        logger.debug('[DataManager] Updating service state');
        this.cachedData = newData;
        const MetroInfoProvider = require('../../../../utils/MetroInfoProvider');
        const metroInfoProvider = MetroInfoProvider.getInstance();
        if (metroInfoProvider) {
            metroInfoProvider.updateData(newData);
        }
        this.emit('data', newData);
        this._emitRawData(newData, false);
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
                source: 'DataManager',
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
                logger.warn('[DataManager] Invalid change object detected. Skipping.', { change });
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
            source: 'DataManager',
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
            debugMode: this.debug,
            activeRequests: this._activeRequests.size,
            overridesActive: Object.values(this.override.getOverrides().lines).some(o => o.enabled) ||
                           Object.values(this.override.getOverrides().stations).some(o => o.enabled),
            staticData: {
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
        logger.info(`[DataManager] Starting polling (${interval}ms)`);
        this.isPolling = true;
        this._pollInterval = setInterval(() => {
            this.fetchNetworkStatus()
                .catch(error => logger.error('[DataManager] Polling error:', error));
        }, interval);

        if (this._pollInterval.unref) {
            this._pollInterval.unref();
        }
    }

    stopPolling() {
        if (!this.isPolling) return;

        logger.info('[DataManager] Stopping polling');
        clearInterval(this._pollInterval);
        this._pollInterval = null;
        this.isPolling = false;
    }

    cleanup() {
        logger.info('[DataManager] Performing cleanup');
        this.stopPolling();
        this.removeAllListeners();
        this._activeRequests.clear();
        this.changeHistory = [];
    }

    async setServiceStatus(status) {
        logger.info(`[DataManager] Setting service status to ${status}`);
        let data;
        if (status === 'open') {
            data = await this.fetchNetworkStatus();
        } else if (status === 'closed') {
            const offHoursData = await this.dbDataManager._generateOffHoursData();
            if (!this.statusMapping) {
                const jsStatusMapping = await this.dbDataManager.dbService.getAllJsStatusMapping();
                this.statusMapping = jsStatusMapping.reduce((acc, item) => {
                    acc[item.js_code] = item;
                    return acc;
                }, {});
            }
            const { lines, stations } = this._extractLineAndStationData(offHoursData);
            const networkSummary = this._generateNetworkSummary(lines, stations);

            data = {
                ...offHoursData,
                lines,
                stations,
                network: networkSummary,
            };
            delete data.lineas;
        }

        if (data) {
            this._updateState(data);
            await this._storeCurrentData(data);
        }

        // This is a circular dependency. It should be removed.
    }

    async activateExpressService() {
        await this.dbDataManager.activateExpressService();
        await this.fetchNetworkStatus();
    }

    async deactivateExpressService() {
        await this.dbDataManager.deactivateExpressService();
        await this.fetchNetworkStatus();
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
            logger.debug('[DataManager] Current data stored successfully');
        } catch (error) {
            logger.error('[DataManager] Failed to store current data', { error });
        }
    }

    _simulateChange(type, data) {
        logger.warn('[DataManager] Simulating change event', { type, data });
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
}

module.exports = DataManager;
