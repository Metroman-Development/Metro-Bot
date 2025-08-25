// modules/metro/core/services/ApiService.js// modules/metro/core/services/ApiService.js
const EventEmitter = require('events');
const { fetch } = require('undici');
const crypto = require('crypto');
const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const { performance } = require('perf_hooks');
const TimeHelpers = require('../../../../utils/timeHelpers');
const logger = require('../../../../events/logger');
const EventRegistry = require('../../../../core/EventRegistry');
const EventPayload = require('../../../../core/EventPayload');
const config = require('../../../../config/metro/metroConfig');
const EstadoRedService = require('./EstadoRedService');
const { translateApiData } = require('../../data/DataTranslator');

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
        this.lineInfoMap = new Map();

        // Service dependencies
        this.timeHelpers = TimeHelpers;
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
                    hasCurrentData: !!this.lastCurrentData,
                    lastCurrentTimestamp: this.lastCurrentTimestamp,
                    cacheValid: !!this.cachedData,
                    dataVersion: this._dataVersion
                }), 
                
               })
            
           }
                
           
      }

    async _initializeLineMetadata() {
        try {
            const dbLines = await this.dbService.getAllLinesStatus();
            for (const line of dbLines) {
                this.lineInfoMap.set(line.line_id.toLowerCase(), line.line_name);
            }
            logger.info('[ApiService] Line metadata initialized successfully.');
        } catch (error) {
            logger.error('[ApiService] Failed to initialize line metadata', { error });
        }
    }

    async getCurrentData() {
        // This function now gets data directly from the MetroInfoProvider.
        // It ensures that the embed manager always has the most up-to-date information.
        logger.debug('[ApiService] getCurrentData called. Fetching fresh data from MetroInfoProvider.');
        if (this.metro && this.metro._subsystems && this.metro._subsystems.metroInfoProvider) {
            return this.metro._subsystems.metroInfoProvider.getFullData();
        }
        logger.warn('[ApiService] MetroInfoProvider not available. Returning last known data.');
        return this.lastCurrentData;
    }

    async fetchNetworkStatus() {
        if (this.lineInfoMap.size === 0) {
            await this._initializeLineMetadata();
        }
        logger.detailed('[ApiService] Starting fetchNetworkStatus');
        if (this.isFetching) {
            logger.warn('[ApiService] Fetch already in progress. Skipping.');
            return;
        }
        this.isFetching = true;
        const requestId = crypto.randomUUID();
        this._activeRequests.add(requestId);
        this.metrics.totalRequests++;
        const startTime = performance.now();

        try {
            let currentData;
            const dbRawData = await this.getDbRawData();
            if (this.timeHelpers.isWithinOperatingHours()) {
                logger.info('[ApiService] Within operating hours. Fetching from API.');
                try {
                    currentData = await this.estadoRedService.fetchStatus();

                    // Enrich line data with names from DB
                    if (currentData && (currentData.lines || currentData.lineas)) {
                        const lines = currentData.lines || currentData.lineas;
                        for (const lineId in lines) {
                            const line = lines[lineId];
                            if (line && !line.nombre) {
                                const lineName = this.lineInfoMap.get(lineId.toLowerCase());
                                if (lineName) {
                                    line.nombre = lineName;
                                    logger.debug(`[ApiService] Enriched line ${lineId} with name "${lineName}"`);
                                }
                            }
                            if (line && line.estaciones) {
                                for (const station of line.estaciones) {
                                    if (dbRawData.lines) {
                                        const dbLine = dbRawData.lines[lineId.toLowerCase()];
                                        if (dbLine && dbLine.estaciones) {
                                            const dbStation = dbLine.estaciones.find(s => s.codigo.toUpperCase() === station.codigo.toUpperCase());
                                            if (dbStation) {
                                                const apiStatus = {
                                                    estado: station.estado,
                                                    descripcion: station.descripcion,
                                                    descripcion_app: station.descripcion_app
                                                };
                                                Object.assign(station, dbStation);
                                                Object.assign(station, apiStatus);
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }

                    logger.info('[ApiService] Successfully fetched data from API.');
                } catch (fetchError) {
                    logger.warn(`[ApiService] Primary fetch failed: ${fetchError.message}. Falling back to database.`);
                    currentData = await this.getDbRawData();
                    if (!currentData || !currentData.lines || Object.keys(currentData.lines).length === 0) {
                        throw new Error("All data sources failed, including database fallback.");
                    }
                }
            } else {
                logger.info('[ApiService] Outside of operating hours. Generating off-hours data.');
                currentData = await this._generateOffHoursData();
            }

            currentData.version = this._dataVersion;

            // This is the new data transformation logic
            const { lines, stations } = this.extractLineAndStationData(currentData);
            const networkSummary = this.generateNetworkSummary(lines);

            const processedData = {
                ...currentData,
                lines,
                stations,
                network: networkSummary,
            };
            delete processedData.lineas;

            const finalData = await this.dataEngine.handleRawData(processedData);

            if (finalData) {
                this.lastRawData = currentData; // Store the original raw data
                this.lastCurrentData = finalData;
                this._updateState(finalData);
                await this._storeCurrentData(finalData);
                this.metrics.lastSuccess = new Date();
            }
            
            return finalData;

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


    async _generateOffHoursData() {
        const dbData = await this.getDbRawData();
        if (!dbData || !dbData.lines) {
            logger.error('[ApiService] Cannot generate off-hours data: no data from database.');
            return { lines: {} };
        }

        const offHoursData = JSON.parse(JSON.stringify(dbData));

        for (const lineId in offHoursData.lines) {
            const line = offHoursData.lines[lineId];
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

        offHoursData.network = {
            status: 'closed',
            timestamp: new Date().toISOString()
        };

        return offHoursData;
    }


    _updateState(newData) {
        logger.debug('[ApiService] Updating service state');
        this.cachedData = newData;
        if (this.metro && this.metro._subsystems && this.metro._subsystems.metroInfoProvider) {
            this.metro._subsystems.metroInfoProvider.updateData(newData);
        }
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

    extractLineAndStationData(currentData) {
        const lines = currentData.lines || currentData.lineas || {};
        const stations = {};
        const sanitizedLines = {};

        for (const [lineId, line] of Object.entries(lines)) {
            // Basic validation for a line object
            if (!line || typeof line !== 'object') {
                logger.warn(`[ApiService] Skipping invalid or incomplete line object with id: ${lineId}`, { line });
                continue;
            }

            const sanitizedLine = {
                ...line,
                id: lineId,
                displayName: line.nombre || this.lineInfoMap.get(lineId.toLowerCase()) || `Línea ${lineId.replace(/l|a/g, '')}`,
                status: line.estado, // map estado to status
            };

            if (Array.isArray(line.estaciones)) {
                sanitizedLine.estaciones = line.estaciones.map(station => {
                    if (!station || typeof station !== 'object' || !station.codigo || !station.nombre) {
                        logger.warn(`[ApiService] Skipping invalid or incomplete station object in line ${lineId}`, { station });
                        return null; // This will be filtered out later
                    }
                    const sanitizedStation = {
                        ...station,
                        id: station.codigo,
                        name: station.nombre,
                        status: station.estado // map estado to status
                    };
                    stations[sanitizedStation.id] = sanitizedStation;
                    return sanitizedStation;
                }).filter(Boolean); // remove nulls
            } else {
                sanitizedLine.estaciones = [];
            }

            sanitizedLines[lineId] = sanitizedLine;
        }
        return { lines: sanitizedLines, stations };
    }

    generateNetworkSummary(lines) {
        if (!lines) {
            return {
                status: 'outage',
                lines: { total: 0, operational: 0, with_issues: [] },
                stations: { total: 0, operational: 0, with_issues: [] },
                timestamp: new Date().toISOString()
            };
        }
        const linesArray = Object.values(lines);
        const stations = linesArray.flatMap(line => line.estaciones || []);
        const operationalLines = linesArray.filter(line => line.estado === '1' || line.estado === 1).length;
        const withIssues = linesArray.filter(line => line.estado !== '1' && line.estado !== 1).map(line => line.id);

        let status = 'operational';
        if (withIssues.length > 0) {
            status = 'degraded';
        }
        if (operationalLines === 0 && linesArray.length > 0) {
            status = 'outage';
        }


        return {
            status,
            lines: {
                total: linesArray.length,
                operational: operationalLines,
                with_issues: withIssues,
            },
            stations: {
                total: stations.length,
                operational: stations.filter(station => station.estado === '1' || station.estado === 1).length,
                with_issues: stations.filter(station => station.estado !== '1' && station.estado !== 1).map(station => station.id),
            },
            timestamp: new Date().toISOString()
        };
    }

    async getDbRawData() {
        // Get latest timestamp from the database
        const latestDbChange = await this.dbService.getLatestStatusChange();
        const dbTimestamp = latestDbChange ? new Date(latestDbChange.changed_at) : new Date(0);

        // Get latest timestamp from the JSON file
        const apiChanges = JSON.parse(await fsp.readFile(path.join(this.cacheDir, 'apiChanges.json'), 'utf8'));
        const latestApiChange = apiChanges.reduce((latest, current) => {
            const currentTime = new Date(current.timestamp);
            return currentTime > new Date(latest.timestamp) ? current : latest;
        });
        const apiTimestamp = new Date(latestApiChange.timestamp);

        let rawData;

        if (dbTimestamp > apiTimestamp) {
            logger.info('[ApiService] Database has newer data. Fetching from DB.');
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
                this.dbService.getAllIntermodalBuses(),
                this.dbService.getNetworkStatus()
            ]);

            const accessibilityByStation = {};
            for (const item of accessibilityStatus) {
                const stationCode = item.station_code.toUpperCase();
                if (!accessibilityByStation[stationCode]) {
                    accessibilityByStation[stationCode] = [];
                }
                accessibilityByStation[stationCode].push(item);
            }

            rawData = {
                lines: {},
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
                rawData.lines[lineId] = {
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
                if (rawData.lines[lineId]) {
                    const stationCode = station.station_code.toUpperCase();
                    rawData.lines[lineId].estaciones.push({
                        ...station,
                        codigo: stationCode,
                        nombre: station.station_name,
                        estado: station.status_data?.js_code || null,
                        descripcion: station.status_data?.status_description || null,
                        descripcion_app: station.status_data?.status_message || null,
                        access_details: accessibilityByStation[stationCode] || []
                    });
                }
            }
        } else {
            logger.info('[ApiService] API changes JSON has newer data. Using latest entry.');
            rawData = latestApiChange;
            // Persist this data to the database
            await this.dbService.updateStatusFromApi(rawData);
        }
        
        return rawData;
    }

}

module.exports = ApiService;
