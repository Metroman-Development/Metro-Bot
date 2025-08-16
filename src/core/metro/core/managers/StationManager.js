// modules/metro/managers/StationManager.js
const EventRegistry = require('../../../../core/EventRegistry');
const EventPayload = require('../../../../core/EventPayload');
const logger = require('../../../../events/logger');
const stringUtils = require('../../utils/stringUtils');
                            
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
            acc[id.toUpperCase()] = this._normalizeStation(station, id);
            return acc;
        }, {});
    }

    _normalizeStation(station, id) {
        const safeStation = station || {};
        return {
            id: id.toUpperCase(),
            code: id.toUpperCase(),
            name: (safeStation.name || 'Unknown Station'),
            line: (safeStation.line || 'UNK').toLowerCase(),
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

            // Index by code
            const codeKey = station.code;
            if (!acc.codes[codeKey]) {
                acc.codes[codeKey] = station.id;
            }

            return acc;
        }, { names: {}, lines: {}, codes: {} });
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
            const upperId = id.toUpperCase();
            if (!this._data[upperId]) {
                changes.added++;
            } else if (JSON.stringify(this._data[upperId]) !== JSON.stringify(station)) {
                changes.updated++;
            }
            this._data[upperId] = this._normalizeStation(station, id);
        });

        // Handle removals
        const existingIds = new Set(Object.keys(newData).map(id => id.toUpperCase()));
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
        if (!id) {
            logger.warn('StationManager.get called with a null or undefined id');
            return null;
        }
        const upperId = id.toUpperCase();
        const station = this._data[upperId];
        if (!station) {
            logger.warn(`[StationManager.get] Station not found: ${id} (used ${upperId})`);
            return null;
        }
        return {
            ...station,
            fullName: `${station.name} (Línea ${station.line})`,
            status: this.getStatus(upperId)
        };
    }

    getByCode(code) {
        if (!code) {
            logger.warn('StationManager.getByCode called with a null or undefined code');
            return null;
        }
        const upperCode = code.toUpperCase();
        const stationId = this._index.codes[upperCode];
        if (!stationId) {
            logger.warn(`[StationManager.getByCode] Station not found for code: ${code}`);
            return null;
        }
        return this.get(stationId);
    }

    getStatus(id) {
        if (!id) return { code: '0', message: 'Station ID not provided' };
        const upperId = id.toUpperCase();
        if (this._statusCache.has(upperId)) {
            return this._statusCache.get(upperId);
        }
        const station = this._data[upperId];
        if (!station) return { code: '0', message: 'Station not found' };
        
        const status = station.status || { code: '0', message: 'Status unknown' };
        this._statusCache.set(upperId, status);
        return status;
    }

    setStatus(id, newStatus) {
        if (!id) return false;
        const upperId = id.toUpperCase();
        if (!this._data[upperId]) {
            logger.warn(`[StationManager.setStatus] Attempted to set status for non-existent station: ${id}`);
            return false;
        }
        
        const oldStatus = this.getStatus(upperId);
        this._data[upperId].status = newStatus;
        this._statusCache.set(upperId, newStatus);

        logger.info(`Status changed for station ${upperId}: ${oldStatus.code} → ${newStatus.code}`);
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