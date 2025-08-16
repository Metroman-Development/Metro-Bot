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
        const staticData = this.metro._staticData || {};
        const dynamicData = this.metro._dynamicData || {};
        const now = new Date();
        const newVersion = `2.0.0-${now.getTime()}`;

        // Explicitly construct the combined object to ensure correct structure
        const combined = {
            // Base properties from static data
            system: staticData.system,
            intermodal: staticData.intermodal,
            trains: staticData.trains,

            // Overwrite with fresh data from dynamic sources
            // Do not fall back to staticData.lines or staticData.stations because their
            // structure is not compatible with the DATA_UPDATED event.
            lines: dynamicData.lines || {},
            stations: dynamicData.stations || {},

            // Properties that should always come from dynamic data
            network: dynamicData.network,
            version: dynamicData.version || newVersion, // This is the top-level version the validator expects
            lastUpdated: dynamicData.lastUpdated || now.toISOString(),
            isFallback: dynamicData.isFallback,

            // Rebuild metadata to be clean, accurate, and free of old version numbers
            metadata: {
                loadDuration: staticData.metadata?.loadDuration,
                sources: staticData.metadata?.sources,
                lastUpdated: dynamicData.lastUpdated || now.toISOString(),
            },
        };

        // If dynamic data didn't provide a network object, create a fallback.
        if (!combined.network || typeof combined.network !== 'object' || !combined.network.status) {
            combined.network = this._getNetworkStatus(combined.lines);
        }

        // Update data managers with the newly combined data
        this._updateManagers(combined);
        
        // Store the result for state consistency
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