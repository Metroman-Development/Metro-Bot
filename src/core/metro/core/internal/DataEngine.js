const EventRegistry = require('../../../../core/EventRegistry');
const EventPayload = require('../../../../core/EventPayload');
const logger = require('../../../../events/logger');

/**
 * Simple object check.
 * @param item
 * @returns {boolean}
 */
function isObject(item) {
    return (item && typeof item === 'object' && !Array.isArray(item));
}

/**
 * Deep merge two objects.
 * @param target
 * @param ...sources
 */
function deepMerge(target, ...sources) {
    if (!sources.length) return target;
    const source = sources.shift();

    if (isObject(target) && isObject(source)) {
        for (const key in source) {
            if (isObject(source[key])) {
                if (!target[key]) Object.assign(target, { [key]: {} });
                deepMerge(target[key], source[key]);
            } else {
                Object.assign(target, { [key]: source[key] });
            }
        }
    }

    return deepMerge(target, ...sources);
}

module.exports = class DataEngine {
    constructor(metro) {
        this.metro = metro;
        this.lastCombinedData = null;
    }

    async handleRawData(currentData) { // Renamed
        try {
            if (!currentData || typeof currentData !== 'object') {
                throw new Error('Invalid currentData received');
            }

            // Data is already processed by ApiService, no need to re-process.
            
            // Store the processed data
            this.metro._dynamicData = currentData;
            
            // Combine with static data
            const combined = this.combine();
            
            // Emit events
            this.metro._safeEmit(EventRegistry.RAW_DATA_PROCESSED, currentData);
            this.metro._safeEmit(EventRegistry.DATA_UPDATED, combined);
            
            return combined;
        } catch (error) {
            this.metro._emitError('handleRawData', error, { rawData: currentData });
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
            lines: deepMerge({}, staticData.lines, dynamicData.lines),
            stations: deepMerge({}, staticData.stations, dynamicData.stations),

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
        } else {
            // Ensure the timestamp field exists for validation, using lastUpdated as a fallback
            if (!combined.network.timestamp && combined.lastUpdated) {
                combined.network.timestamp = combined.lastUpdated;
            }
        }

        // Update data managers with the newly combined data
        this._updateManagers(combined);
        
        // Store the result for state consistency
        this.lastCombinedData = combined;
        this.metro._combinedData = combined;
        
        if (this.metro._subsystems.metroInfoProvider) {
            this.metro._subsystems.metroInfoProvider.updateData(combined);
        }

        return combined;
    }

    _getNetworkStatus(lines) {
        const now = new Date().toISOString();
        if (!lines || Object.keys(lines).length === 0) {
            return { status: 'outage', timestamp: now, lastUpdated: now };
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
            timestamp: now,
            lastUpdated: now
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