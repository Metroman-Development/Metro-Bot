// modules/metro/managers/StationManager.js
const EventRegistry = require('../../../../core/EventRegistry');
const EventPayload = require('../../../../core/EventPayload');
const logger = require('../../../../events/logger');
const stringUtils = require('../../utils/stringHandlers'); 
                            
const metroConfig = require('../../../../config/metro/metroConfig');

class StationManager {
    constructor(data = {}, utils = null) {
        // Initialize with safe defaults
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
        this._index = this._buildIndex();
        this._statusCache = new Map();
    }

    _initializeData(rawData) {
        return Object.entries(rawData).reduce((acc, [id, station]) => {
            acc[id] = this._normalizeStation(station, id);
            return acc;
        }, {});
    }

    _normalizeStation(station, id) {
        const safeStation = station || {};
        return {
            id: id,
            name: (safeStation.name || 'Unknown Station').toUpperCase(),
            line: safeStation.line || 'UNK',
            status: safeStation.status || { code: '0', message: 'Status unknown' },
            coordinates: safeStation.coordinates || { lat: 0, lng: 0 },
            facilities: safeStation.facilities || [],
            metadata: safeStation.metadata || {}
        };
    }

    _buildIndex() {
        return Object.values(this._data).reduce((acc, station) => {
            // Index by name
            const nameKey = station.name.toLowerCase();
            if (!acc.names[nameKey]) {
                acc.names[nameKey] = [];
            }
            acc.names[nameKey].push(station.id);

            // Index by line
            const lineKey = station.line.toLowerCase();
            if (!acc.lines[lineKey]) {
                acc.lines[lineKey] = [];
            }
            acc.lines[lineKey].push(station.id);

            return acc;
        }, { names: {}, lines: {} });
    }

    // Core Methods
    updateData(newData) {
        const changes = {
            added: 0,
            updated: 0,
            removed: 0
        };

        // Handle updates
        Object.entries(newData).forEach(([id, station]) => {
            if (!this._data[id]) {
                changes.added++;
            } else if (JSON.stringify(this._data[id]) !== JSON.stringify(station)) {
                changes.updated++;
            }
            this._data[id] = this._normalizeStation(station, id);
        });

        // Handle removals
        const existingIds = new Set(Object.keys(newData));
        Object.keys(this._data).forEach(id => {
            if (!existingIds.has(id)) {
                delete this._data[id];
                changes.removed++;
            }
        });

        // Rebuild index if needed
        if (changes.added > 0 || changes.removed > 0) {
            this._index = this._buildIndex();
        }

        logger.debug(`StationManager updated: ${changes.added} added, ${changes.updated} updated, ${changes.removed} removed`);
        return changes;
    }

    get(id) {
        const station = this._data[id];
        if (!station) {
            logger.warn(`Station not found: ${id}`);
            return null;
        }
        return {
            ...station,
            fullName: `${station.name} (Line ${station.line})`,
            status: this.getStatus(id)
        };
    }

    getStatus(id) {
        if (this._statusCache.has(id)) {
            return this._statusCache.get(id);
        }
        const station = this._data[id];
        if (!station) return { code: '0', message: 'Station not found' };
        
        const status = station.status || { code: '0', message: 'Status unknown' };
        this._statusCache.set(id, status);
        return status;
    }

    setStatus(id, newStatus) {
        if (!this._data[id]) return false;
        
        const oldStatus = this.getStatus(id);
        this._data[id].status = newStatus;
        this._statusCache.set(id, newStatus);

        logger.info(`Status changed for station ${id}: ${oldStatus.code} → ${newStatus.code}`);
        return true;
    }

    // Search Methods
    search(query, options = {}) {
        const { fuzzy = true, limit = 10 } = options;
        const term = query.toLowerCase().trim();

        if (!term) return [];

        // Exact match
        if (this._index.names[term]) {
            return this._index.names[term]
                .slice(0, limit)
                .map(id => this.get(id));
        }

        // Fuzzy search
        return Object.entries(this._index.names)
            .filter(([name]) => fuzzy ? name.includes(term) : name === term)
            .sort((a, b) => a[0].length - b[0].length) // Prefer shorter matches
            .flatMap(([_, ids]) => ids)
            .slice(0, limit)
            .map(id => this.get(id));
    }

    getByLine(lineId) {
        const normalizedLine = lineId.toLowerCase();
        return (this._index.lines[normalizedLine] || [])
            .map(id => this.get(id));
    }

    // Utility Methods
    count() {
        return Object.keys(this._data).length;
    }

    getAll() {
        return Object.values(this._data).map(station => ({
            ...station,
            status: this.getStatus(station.id)
        }));
    }

    // Maintenance
    clearCache() {
        this._statusCache.clear();
        logger.debug('Cleared station status cache');
    }
}

module.exports = StationManager;