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
        const combined = {
            ...this.metro._staticData,
            ...this.metro._dynamicData,
        };

        // If dynamic data doesn't have a network object, create a basic one.
        if (!combined.network) {
            combined.network = this._getNetworkStatus(combined.lines);
        }

        // Update managers with fresh data
        this._updateManagers(combined);
        
        // Store and return
        this.lastCombinedData = combined;
        this.metro._combinedData = combined;
        
        return combined;
    }

    _getNetworkStatus(lines) {
        if (!lines || Object.keys(lines).length === 0) {
            return { status: 'outage', lastUpdated: new Date().toISOString() };
        }

        const lineStatuses = Object.values(lines).map(line => line.status);

        let operationalLines = 0;
        let degradedLines = 0;

        for (const status of lineStatuses) {
            if (status === '1') { // Assuming '1' is operational
                operationalLines++;
            } else {
                degradedLines++;
            }
        }

        let overallStatus = 'operational';
        if (degradedLines > 0 && operationalLines === 0) {
            overallStatus = 'outage';
        } else if (degradedLines > 0) {
            overallStatus = 'degraded';
        }

        return {
            status: overallStatus,
            lastUpdated: new Date().toISOString()
        };
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


    getLastCombinedData() {
        return this.lastCombinedData;
    }
};