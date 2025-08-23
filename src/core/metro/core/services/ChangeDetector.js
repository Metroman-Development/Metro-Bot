// modules/metro/core/services/ChangeDetector.js
// modules/metro/core/services/ChangeDetector.js
// modules/metro/core/services/ChangeDetector.js
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../../../../events/logger');
const EventRegistry = require('../../../../core/EventRegistry');
const EventPayload = require('../../../../core/EventPayload');
const { getTimestamp } = require('../../../../utils/timeHelpers');
const baseline = {}

class ChangeDetector {
    constructor(metro, dbService) {
        this.metro = metro;
        this.dbService = dbService;
        this.latestChanges = [];
        this.lastData = baseline;
        this.lastLineStates = new Map();
        this.lastStationStates = new Map();
        this.instanceId = crypto.randomUUID();
        this.cachedNetwork = {
            status: 'unknown',
            lastUpdated: null,
            lines: {}
        };
        this.apiChangesPath = path.join(__dirname, '../../../../data/apiChanges.json');
    }

    async _getLatestApiChangeTimestamp() {
        try {
            const data = await fs.readFile(this.apiChangesPath, 'utf8');
            const apiChanges = JSON.parse(data);
            if (apiChanges.length > 0 && apiChanges[0].timestamp) {
                return new Date(apiChanges[0].timestamp);
            }
        } catch (error) {
            if (error.code !== 'ENOENT') {
                logger.error('[ChangeDetector] Failed to read apiChanges.json', { error });
            }
        }
        return null;
    }

    async _getLatestChangeTimestampFromDb() {
        const latestChange = await this.dbService.getLatestChange();
        return latestChange ? new Date(latestChange.changed_at) : null;
    }


    /**
     * Analyzes new data and detects changes
     * @param {Object} newData - The new data to analyze
     * @returns {Object} - Change detection result with metadata and changes
     */
    async analyze(newData, oldData = null, currentData = null) {
        try {
            if (!newData || typeof newData !== 'object') {
                logger.warn('[ChangeDetector] Invalid data provided for analysis');
            }

            const estadoRedPath = path.join(__dirname, '../../../../data/estadoRed.json');
            let referenceData = {};
            try {
                const data = await fs.readFile(estadoRedPath, 'utf8');
                referenceData = JSON.parse(data);
            } catch (error) {
                if (error.code !== 'ENOENT') {
                    logger.error('[ChangeDetector] Failed to read estadoRed.json', { error });
                }
            }

            const earliestChangeTimestamp = getTimestamp(newData.timestamp);
            const latestDbChangeTimestamp = await this._getLatestChangeTimestampFromDb();
            const latestApiChangeTimestamp = await this._getLatestApiChangeTimestamp();

            logger.info(`[ChangeDetector] Timestamps - Earliest: ${earliestChangeTimestamp}, DB: ${latestDbChangeTimestamp}, API: ${latestApiChangeTimestamp}`);

            if (earliestChangeTimestamp && latestDbChangeTimestamp && latestApiChangeTimestamp) {
                if (earliestChangeTimestamp > latestDbChangeTimestamp && earliestChangeTimestamp > latestApiChangeTimestamp) {
                    // New change is newer than both, proceed
                } else {
                    logger.info('[ChangeDetector] No new changes detected based on timestamps. Skipping analysis.');
                    return {
                        metadata: this._generateMetadata(newData, []),
                        changes: [],
                        networkStatus: this.cachedNetwork
                    };
                }
            }

            // Detect changes and update network status
            let changes = this._detectChanges(newData, referenceData, currentData);

            this._updateNetworkStatus(newData, changes);
            this._updateLastStates(newData);

            return {
                metadata: this._generateMetadata(newData, changes),
                changes: changes,
                networkStatus: this.cachedNetwork
            };
        } catch (error) {
            logger.error('[ChangeDetector] Analysis failed', {
                error: error.message,
                stack: error.stack
            });
            return this._createFallbackResponse(error);
        }
    }

    /**
     * Detects changes between current and new data
     * @private
     */
    _detectChanges(newData, referenceData, currentData) {
        const changesMap = new Map();
        const isInitialRun = !referenceData || Object.keys(referenceData).length === 0;

        Object.entries(newData).forEach(([lineId, lineData]) => {
            if (!this._isValidLineId(lineId)) return;

            // Process line changes
            const previousLine = referenceData?.[lineId];
            const fromState = previousLine?.estado ?? 'unknown';
            const toState = lineData.estado ?? 'unknown';

            if (isInitialRun || fromState !== toState) {
                const change = this._createLineChange(
                    lineId,
                    fromState,
                    toState,
                    lineData.mensaje || '',
                    currentData
                );
                const existingChange = changesMap.get(change.id);
                if (!existingChange || new Date(change.timestamp) > new Date(existingChange.timestamp)) {
                    changesMap.set(change.id, change);
                }
            }

            // Process station changes
            this._processStationChanges(
                changesMap,
                lineId,
                lineData.estaciones || [],
                referenceData,
                isInitialRun,
                currentData
            );
        });

        const changes = Array.from(changesMap.values());
        this.latestChanges = changes;

        return changes;
    }
    
    getLatest()  {
        
        return this.latestChanges;
        
       } 

    /**
     * Processes station-level changes
     * @private
     */
    _processStationChanges(changesMap, lineId, stations, referenceData, isInitialRun, currentData) {
        stations.forEach(station => {
            const stationId = station.codigo?.toLowerCase();
            if (!stationId) return;

            // First try to find the station in referenceData
            let fromState = 'unknown';
            if (referenceData && referenceData[lineId]) {
                const previousStation = (referenceData[lineId].estaciones || [])
                    .find(s => s.codigo?.toLowerCase() === stationId);
                if (previousStation) {
                    fromState = previousStation.estado ?? 'unknown';
                }
            }

            // Fall back to lastStationStates if not found in referenceData
            if (fromState === 'unknown' && this.lastStationStates.has(stationId)) {
                fromState = this.lastStationStates.get(stationId).estado ?? 'unknown';
            }

            const toState = station.estado ?? 'unknown';

            if (isInitialRun || fromState !== toState) {
                const change = this._createStationChange(
                    stationId,
                    station.nombre || `Station ${stationId}`,
                    lineId,
                    fromState,
                    toState,
                    station.descripcion || '',
                    currentData
                );
                const existingChange = changesMap.get(change.id);
                if (!existingChange || new Date(change.timestamp) > new Date(existingChange.timestamp)) {
                    changesMap.set(change.id, change);
                }
            }
        });
    }

    /**
     * Updates the cached network status
     * @private
     */
    _updateNetworkStatus(newData, changes) {
        const networkStatus = {
            status: 'normal',
            lastUpdated: new Date(),
            lines: {}
        };

        // Calculate overall network status
        Object.entries(newData).forEach(([lineId, lineData]) => {
            if (!this._isValidLineId(lineId)) return;

            networkStatus.lines[lineId] = {
                status: lineData.estado || 'unknown',
                message: lineData.mensaje || ''
            };

            if (lineData.estado === '4') {
                networkStatus.status = 'critical';
            } else if (lineData.estado === '3' && networkStatus.status !== 'critical') {
                networkStatus.status = 'high';
            }
        });

        this.cachedNetwork = networkStatus;
    }

    /**
     * Updates the last known states
     * @private
     */
    _updateLastStates(newData) {
        this.lastLineStates.clear();
        this.lastStationStates.clear();

        Object.entries(newData).forEach(([lineId, lineData]) => {
            if (!this._isValidLineId(lineId)) return;

            this.lastLineStates.set(lineId, {
                estado: lineData.estado,
                mensaje: lineData.mensaje
            });

            (lineData.estaciones || []).forEach(station => {
                const stationId = station.codigo?.toLowerCase();
                if (stationId) {
                    this.lastStationStates.set(stationId, {
                        estado: station.estado,
                        descripcion: station.descripcion,
                        line: lineId
                    });
                }
            });
        });

        this.lastData = newData;
    }

    /**
     * Creates a line change object
     * @private
     */
    _createLineChange(lineId, oldStatus, newStatus, message, currentData) {
        const lineData = currentData?.lines?.[lineId];
        return {
            type: 'line',
            id: lineId,
            name: `Line ${lineId.slice(1)}`,
            from: oldStatus,
            to: lineData?.status || newStatus,
            message: message,
            timestamp: new Date().toISOString(),
            severity: this._calculateSeverity(oldStatus, newStatus)
        };
    }

    /**
     * Creates a station change object
     * @private
     */
    _createStationChange(stationId, stationName, lineId, oldStatus, newStatus, description, currentData) {
        const stationData = currentData?.stations?.[stationId.toUpperCase()];
        return {
            type: 'station',
            id: stationId,
            name: stationName,
            line: lineId,
            from: oldStatus,
            to: stationData?.status || newStatus,
            description: description,
            timestamp: new Date().toISOString(),
            severity: this._calculateSeverity(oldStatus, newStatus)
        };
    }

    /**
     * Calculates severity based on state transition
     * @private
     */
    _calculateSeverity(oldStatus, newStatus) {
        const statusPriority = {
            '4': 4, // Critical
            '3': 3, // High
            '2': 2, // Medium
            '1': 1, // Normal
            '0': 0  // Closed
        };

        const oldPriority = statusPriority[oldStatus] || 1;
        const newPriority = statusPriority[newStatus] || 1;
        const delta = newPriority - oldPriority;

        if (delta >= 2) return 'critical';
        if (delta === 1) return 'high';
        if (delta === -1) return 'medium';
        if (delta <= -2) return 'low';
        return 'none';
    }

    /**
     * Generates metadata about the changes
     * @private
     */
    _generateMetadata(newData, changes) {
        const lines = Object.keys(newData).filter(k => this._isValidLineId(k));
        const stations = [];

        Object.entries(newData).forEach(([_, lineData]) => {
            (lineData.estaciones || []).forEach(station => {
                if (station.codigo) {
                    stations.push(station.codigo.toLowerCase());
                }
            });
        });

        return {
            lines: lines,
            stations: stations,
            lineCount: lines.length,
            stationCount: stations.length,
            changeCount: changes.length,
            isFirstRun: this.lastData === null,
            timestamp: new Date().toISOString(),
            severity: this._getOverallSeverity(changes),
            systemFields: {
                instanceId: this.instanceId,
                analysisId: crypto.randomUUID()
            }
        };
    }

    /**
     * Determines overall severity from changes
     * @private
     */
    _getOverallSeverity(changes) {
        if (changes.length === 0) return 'none';
        
        const severities = changes.map(c => c.severity);
        if (severities.includes('critical')) return 'critical';
        if (severities.includes('high')) return 'high';
        if (severities.includes('medium')) return 'medium';
        return 'low';
    }

    /**
     * Creates a fallback response when analysis fails
     * @private
     */
    _createFallbackResponse(error) {
        return {
            metadata: {
                lines: [],
                stations: [],
                lineCount: 0,
                stationCount: 0,
                changeCount: 0,
                isFirstRun: false,
                timestamp: new Date().toISOString(),
                severity: 'critical',
                systemFields: {
                    instanceId: this.instanceId,
                    analysisId: 'fallback-' + crypto.randomUUID(),
                    error: error?.message || 'Unknown error'
                }
            },
            changes: [],
            networkStatus: {
                status: 'critical',
                lastUpdated: new Date(),
                lines: {}
            }
        };
    }

    /**
     * Validates line IDs
     * @private
     */
    _isValidLineId(lineId) {
        return typeof lineId === 'string' && lineId.startsWith('l');
    }

    /**
     * Gets the current network status
     */
    getNetworkStatus() {
        return this.cachedNetwork;
    }

    /**
     * Gets the last known data state
     */
    getLastState() {
        return this.lastData;
    }

    /**
     * Gets recent changes (last analysis)
     */
    getRecentChanges() {
        return this.lastChanges || [];
    }
}

module.exports = ChangeDetector;