// modules/metro/core/services/ApiServiceOverride.js
const path = require('path');
const fs = require('fs').promises;
const logger = require('../../../../events/logger');

class ApiServiceOverride {
    constructor() {
        this.overrideFile = path.join(__dirname, '../../../../config/metro/statusOverrides.json');
        this.overrides = {
            lines: {},
            stations: {}
        };
        this.lastModified = 0;
    }

    async loadOverrides() {
        try {
            const stats = await fs.stat(this.overrideFile);
            if (stats.mtimeMs <= this.lastModified) {
                return false; // No changes
            }

            const data = await fs.readFile(this.overrideFile, 'utf8');
            const parsed = JSON.parse(data);
            
            // Validate and normalize the override structure
            this.overrides = {
                lines: this._normalizeLineOverrides(parsed.lines || {}),
                stations: this._normalizeStationOverrides(parsed.stations || {})
            };
            
            this.lastModified = stats.mtimeMs;
            logger.debug('[ApiServiceOverride] Loaded new overrides');
            return true;
        } catch (error) {
            if (error.code === 'ENOENT') {
                logger.debug('[ApiServiceOverride] No override file found');
                return false;
            }
            logger.error('[ApiServiceOverride] Failed to load overrides', { error });
            return false;
        }
    }

    _normalizeLineOverrides(rawOverrides) {
        const normalized = {};
        
        for (const [lineId, override] of Object.entries(rawOverrides)) {
            if (!lineId.match(/^l[1-6]$/)) continue;
            
            normalized[lineId] = {
                estado: String(override.estado || '1'),
                mensaje: String(override.mensaje || ''),
                mensaje_app: String(override.mensaje_app || ''),
                enabled: !!override.enabled
            };
        }
        
        return normalized;
    }

    _normalizeStationOverrides(rawOverrides) {
        const normalized = {};
        
        for (const [stationCode, override] of Object.entries(rawOverrides)) {
            normalized[stationCode] = {
                estado: String(override.estado || '1'),
                descripcion: String(override.descripcion || ''),
                descripcion_app: String(override.descripcion_app || ''),
                enabled: !!override.enabled
            };
        }
        
        return normalized;
    }

    applyOverrides(rawData) {
        if (!rawData) return rawData;
        
        // Apply line overrides
        for (const [lineId, override] of Object.entries(this.overrides.lines)) {
            if (!override.enabled || !rawData[lineId]) continue;
            
            rawData[lineId].estado = override.estado;
            if (override.mensaje) rawData[lineId].mensaje = override.mensaje;
            if (override.mensaje_app) rawData[lineId].mensaje_app = override.mensaje_app;
            
            logger.debug(`[ApiServiceOverride] Applied override for line ${lineId}`);
        }
        
        // Apply station overrides
        for (const [stationCode, override] of Object.entries(this.overrides.stations)) {
            if (!override.enabled) continue;
            
            for (const lineData of Object.values(rawData)) {
                if (!Array.isArray(lineData.estaciones)) continue;
                
                const station = lineData.estaciones.find(s => s.codigo === stationCode);
                if (station) {
                    station.estado = override.estado;
                    if (override.descripcion) station.descripcion = override.descripcion;
                    if (override.descripcion_app) station.descripcion_app = override.descripcion_app;
                    
                    logger.debug(`[ApiServiceOverride] Applied override for station ${stationCode}`);
                }
            }
        }
        
        return rawData;
    }
}

module.exports = ApiServiceOverride;