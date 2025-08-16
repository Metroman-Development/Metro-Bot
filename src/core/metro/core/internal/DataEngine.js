// modules/metro/core/internal/DataEngine.js
// modules/metro/core/internal/DataEngine.js
// modules/metro/core/internal/DataEngine.js
const EventRegistry = require('../../../../core/EventRegistry');
const EventPayload = require('../../../../core/EventPayload');
const logger = require('../../../../events/logger');

module.exports = class DataEngine {
    constructor(metro) {
        this.metro = metro;
        this.lastCombinedData = null;
    }

    async handleRawData(processedData) { // Renamed
        try {
            if (!processedData || typeof processedData !== 'object') {
                throw new Error('Invalid processedData received');
            }

            // Data is already processed by ApiService, no need to re-process.
            
            // Store the processed data
            this.metro._dynamicData = processedData;
            
            // Combine with static data
            const combined = this.combine();
            
            // Emit events
            this.metro._safeEmit(EventRegistry.RAW_DATA_PROCESSED, processedData);
            this.metro._safeEmit(EventRegistry.DATA_UPDATED, combined);
            
            return combined;
        } catch (error) {
            this.metro._emitError('handleRawData', error, { rawData: processedData });
            return null;
        }
    }

    combine() {
        const dynamicData = this.metro._dynamicData || {};
        const staticData = this.metro._staticData || {};

        // Prioritize dynamic data, but ensure all static data is carried over.
        const combined = {
            ...staticData,
            ...dynamicData, // Overwrites lines, stations, etc. with fresh data
            network: dynamicData.network || staticData.network || { status: 'initializing' },
            version: dynamicData.version || staticData.version || '0.0.0',
            lastUpdated: new Date(),
        };

        // Update managers with fresh data
        this._updateManagers(combined);
        
        // Store and return
        this.lastCombinedData = combined;
        this.metro._combinedData = combined;
        
        return combined;
    }

    _updateManagers(data) {
        if (this.metro._subsystems.managers.stations) {
            this.metro._subsystems.managers.stations.updateData(
                data.stations || {}
            );
        }
        
        if (this.metro._subsystems.managers.lines) {
            this.metro._subsystems.managers.lines.updateData(
                data.lines || {}
            );
        }
    }

    createStationInterface(stationsData) {
        return {
            getAll: () => Object.values(stationsData),
            get: (id) => {
                const station = stationsData[id.toLowerCase()];
                if (!station) {
                    this.metro.emit(EventRegistry.STATION_NOT_FOUND, 
                        new EventPayload(
                            EventRegistry.STATION_NOT_FOUND,
                            { stationId: id },
                            { source: 'StationManager' }
                        )
                    );
                    return null;
                }
                return station;
            },
            search: (query) => {
                const term = query.toLowerCase();
                return Object.values(stationsData).filter(s =>
                    s.name.toLowerCase().includes(term) ||
                    (s.displayName && s.displayName.toLowerCase().includes(term))
                );
            },
            count: () => Object.keys(stationsData).length,
            getByLine: (lineId) => Object.values(stationsData)
                .filter(s => s.line === lineId.toLowerCase())
        };
    }

    createLineInterface(linesData) {
        return {
            getAll: () => Object.values(linesData),
            get: (id) => {
                const line = linesData[id.toLowerCase()];
                if (!line) {
                    this.metro.emit(EventRegistry.LINE_NOT_FOUND,
                        new EventPayload(
                            EventRegistry.LINE_NOT_FOUND,
                            { lineId: id },
                            { source: 'LineManager' }
                        )
                    );
                    return null;
                }
                return line;
            },
            getStatusSummary: () => {
                return Object.values(linesData).reduce((acc, line) => {
                    const status = line.status?.normalized || 'unknown';
                    acc[status] = (acc[status] || 0) + 1;
                    return acc;
                }, {});
            },
            count: () => Object.keys(linesData).length
        };
    }

    getLastCombinedData() {
        return this.lastCombinedData;
    }
};