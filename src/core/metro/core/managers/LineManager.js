// modules/metro/managers/LineManager.js
const EventRegistry = require('../../../../core/EventRegistry');
const EventPayload = require('../../../../core/EventPayload');
const logger = require('../../../../events/logger');
const stringUtils = require('../../utils/stringHandlers');
const metroConfig = require('../../../../config/metro/metroConfig');

class LineManager {
    constructor(data = {}, utils = null) {
        this._utils = utils || {
            string: stringUtils,
            config: metroConfig,
            getSafe: (obj, path, def = null) => {
                try {
                    return path.split('.').reduce((o, p) => o && o[p], obj) || def;
                } catch (e) {
                    return def;
                }
            }
        };

        this._data = this._initializeData(data);
        this._statusCache = new Map();
        this._stationIndex = {};
    }

    _initializeData(rawData) {
        return Object.entries(rawData).reduce((acc, [id, line]) => {
            acc[id.toLowerCase()] = this._normalizeLine(line, id);
            return acc;
        }, {});
    }

    _normalizeLine(line, id) {
        return {
            id: id.toLowerCase(),
            displayName: line.displayName || `Line ${id.toUpperCase()}`,
            color: line.color || '#cccccc',
            status: line.status || { code: '0', message: 'Status unknown' },
            stations: line.stations || [],
            schedule: line.schedule || {},
            metadata: line.metadata || {}
        };
    }

    // Core Methods
    updateData(newData) {
        const changes = {
            added: 0,
            updated: 0,
            removed: 0
        };

        // Process updates
        Object.entries(newData).forEach(([id, line]) => {
            const normalizedId = id.toLowerCase();
            if (!this._data[normalizedId]) {
                changes.added++;
            } else if (JSON.stringify(this._data[normalizedId]) !== JSON.stringify(line)) {
                changes.updated++;
            }
            this._data[normalizedId] = this._normalizeLine(line, id);
        });

        // Process removals
        const existingIds = new Set(Object.keys(newData).map(id => id.toLowerCase()));
        Object.keys(this._data).forEach(id => {
            if (!existingIds.has(id)) {
                delete this._data[id];
                changes.removed++;
            }
        });

        logger.debug(`LineManager updated: ${changes.added} added, ${changes.updated} updated, ${changes.removed} removed`);
        return changes;
    }

    get(id) {
        const normalizedId = id.toLowerCase();
        const line = this._data[normalizedId];
        if (!line) {
            logger.warn(`Line not found: ${id}`);
            return null;
        }
        return {
            ...line,
            status: this.getStatus(normalizedId),
            stationCount: line.stations.length
        };
    }

    getStatus(id) {
        const normalizedId = id.toLowerCase();
        if (this._statusCache.has(normalizedId)) {
            return this._statusCache.get(normalizedId);
        }
        const line = this._data[normalizedId];
        if (!line) return { code: '0', message: 'Line not found' };
        
        const status = line.status || { code: '0', message: 'Status unknown' };
        this._statusCache.set(normalizedId, status);
        return status;
    }

    setStatus(id, newStatus) {
        const normalizedId = id.toLowerCase();
        if (!this._data[normalizedId]) return false;
        
        const oldStatus = this.getStatus(normalizedId);
        this._data[normalizedId].status = newStatus;
        this._statusCache.set(normalizedId, newStatus);

        logger.info(`Status changed for line ${normalizedId}: ${oldStatus.code} → ${newStatus.code}`);
        return true;
    }

    // Station Management
    addStation(lineId, stationData) {
        const normalizedLineId = lineId.toLowerCase();
        if (!this._data[normalizedLineId]) return false;

        if (!this._data[normalizedLineId].stations.includes(stationData.id)) {
            this._data[normalizedLineId].stations.push(stationData.id);
            logger.debug(`Added station ${stationData.id} to line ${normalizedLineId}`);
            return true;
        }
        return false;
    }

    removeStation(lineId, stationId) {
        const normalizedLineId = lineId.toLowerCase();
        if (!this._data[normalizedLineId]) return false;

        const index = this._data[normalizedLineId].stations.indexOf(stationId);
        if (index >= 0) {
            this._data[normalizedLineId].stations.splice(index, 1);
            logger.debug(`Removed station ${stationId} from line ${normalizedLineId}`);
            return true;
        }
        return false;
    }

    // Query Methods
    getAll() {
        return Object.values(this._data).map(line => ({
            ...line,
            status: this.getStatus(line.id)
        }));
    }

    getByStatus(statusCode) {
        return Object.values(this._data)
            .filter(line => this.getStatus(line.id).code === statusCode)
            .map(line => this.get(line.id));
    }

    // Utility Methods
    count() {
        return Object.keys(this._data).length;
    }

    getStatusSummary() {
        return Object.values(this._data).reduce((acc, line) => {
            const status = this.getStatus(line.id).code || 'unknown';
            acc[status] = (acc[status] || 0) + 1;
            return acc;
        }, {});
    }

    // Maintenance
    clearCache() {
        this._statusCache.clear();
        logger.debug('Cleared line status cache');
    }
}

module.exports = LineManager;