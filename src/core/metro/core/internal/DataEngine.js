const EventRegistry = require('../../../../core/EventRegistry');
const logger = require('../../../../events/logger');

module.exports = class DataEngine {
    constructor(metro) {
        this.metro = metro;
    }

    async handleRawData(currentData) {
        try {
            if (!currentData || typeof currentData !== 'object') {
                throw new Error('Invalid currentData received');
            }

            // Data is already processed by ApiService, no need for combining.
            // The new data structure is self-contained.

            // Basic validation for critical fields
            if (!currentData.network || !currentData.version) {
                logger.warn('[DataEngine] Incoming data is missing network or version fields.', {
                    hasNetwork: !!currentData.network,
                    hasVersion: !!currentData.version,
                });
                // Do not proceed if the data is fundamentally flawed.
                return null;
            }

            // Update managers with the new, complete data
            this._updateManagers(currentData);

            // Update MetroInfoProvider
            if (this.metro._subsystems.metroInfoProvider) {
                this.metro._subsystems.metroInfoProvider.updateData(currentData);
            }

            // Store the data in the metro core for state consistency
            this.metro._combinedData = currentData;

            // Emit events
            this.metro._safeEmit(EventRegistry.RAW_DATA_PROCESSED, currentData);
            this.metro._safeEmit(EventRegistry.DATA_UPDATED, currentData);
            
            return currentData;
        } catch (error) {
            this.metro._emitError('handleRawData', error, { rawData: currentData });
            return null;
        }
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
        return this.metro._combinedData;
    }
};