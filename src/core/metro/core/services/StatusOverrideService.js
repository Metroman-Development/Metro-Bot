// modules/metro/core/services/StatusOverrideService.js
// modules/metro/core/services/StatusOverrideService.js
// modules/metro/core/services/StatusOverrideService.js

const path = require('path');

const fs = require('fs').promises;

const logger = require('../../../../events/logger');

const DiscordBotService = require('./DiscordBotService');

//const config = require('../../../../config/metro/overrideConfig');

class StatusOverrideService {

    constructor() {

        this.overrideFile = path.join(__dirname, '../../../../config/metro/statusOverrides.json');

        this.overrides = {

            lines: {},

            stations: {}

        };

        this.lastModified = 0;

        this.discordBot = new DiscordBotService();

        this.changeHistory = [];

        this.lock = false;

    }

    async loadOverrides() {

        if (this.lock) {

            logger.debug('[StatusOverride] Load operation already in progress');

            return false;

        }

        this.lock = true;

        try {

            const stats = await fs.stat(this.overrideFile).catch(() => null);

            if (!stats || stats.mtimeMs <= this.lastModified) {

                return false;

            }

            const oldOverrides = this._deepClone(this.overrides);

            const data = await fs.readFile(this.overrideFile, 'utf8');

            const parsed = JSON.parse(data);

            

            this.overrides = {

                lines: this._normalizeLineOverrides(parsed.lines || {}),

                stations: this._normalizeStationOverrides(parsed.stations || {})

            };

            

            this.lastModified = stats.mtimeMs;

            logger.debug('[StatusOverride] Overrides loaded successfully');

            const changes = await this._detectChanges(oldOverrides);

            if (changes.length > 0) {

                this._addToHistory(changes);

                await this._handleChanges(changes);

            }

            return true;

        } catch (error) {

            if (error.code === 'ENOENT') {

                logger.debug('[StatusOverride] Override file not found');

                return false;

            }

            logger.error('[StatusOverride] Failed to load overrides', error);

            throw error;

        } finally {

            this.lock = false;

        }

    }

    async saveOverrides(newOverrides) {

        if (this.lock) {

            throw new Error('Override system is currently busy');

        }

        this.lock = true;

        try {

            const oldOverrides = this._deepClone(this.overrides);

            const normalized = {

                lines: this._normalizeLineOverrides(newOverrides.lines || {}),

                stations: this._normalizeStationOverrides(newOverrides.stations || {})

            };

            await fs.writeFile(

                this.overrideFile,

                JSON.stringify(normalized, null, 2),

                'utf8'

            );

            this.overrides = normalized;

            const stats = await fs.stat(this.overrideFile);

            this.lastModified = stats.mtimeMs;

            const changes = await this._detectChanges(oldOverrides);

            if (changes.length > 0) {

                this._addToHistory(changes);

                await this._handleChanges(changes);

            }

            logger.info('[StatusOverride] Overrides saved successfully');

            return true;

        } catch (error) {

            logger.error('[StatusOverride] Failed to save overrides', error);

            throw error;

        } finally {

            this.lock = false;

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

                enabled: !!override.enabled,

                expressSupressed: override.expressSupressed === true,

                stations: Array.isArray(override.stations) ? 

                    override.stations.map(s => s.toLowerCase()) : [],

                metadata: {

                    lastUpdated: override.metadata?.lastUpdated || new Date().toISOString(),

                    updatedBy: override.metadata?.updatedBy || 'system'

                }

            };

        }

        

        return normalized;

    }

    _normalizeStationOverrides(rawOverrides) {

        const normalized = {};

        

        for (const [stationCode, override] of Object.entries(rawOverrides)) {

            normalized[stationCode.toLowerCase()] = {

                estado: String(override.estado || '1'),

                descripcion: String(override.descripcion || ''),

                descripcion_app: String(override.descripcion_app || ''),

                enabled: !!override.enabled,

                isTransferOperational: override.isTransferOperational === true,

                accessPointsOperational: override.accessPointsOperational === true,

                metadata: {

                    lastUpdated: override.metadata?.lastUpdated || new Date().toISOString(),

                    updatedBy: override.metadata?.updatedBy || 'system'

                }

            };

        }

        

        return normalized;

    }

    async _detectChanges(oldOverrides) {

        const changes = [];

        

        // Check line overrides

        for (const [lineId, newOverride] of Object.entries(this.overrides.lines)) {

            const oldOverride = oldOverrides.lines[lineId];

            if (!oldOverride) continue;

            if (newOverride.expressSupressed !== oldOverride.expressSupressed) {

                changes.push({

                    type: 'expressSupressed',

                    lineId,

                    stationCode: null,

                    previousState: oldOverride.expressSupressed,

                    newState: newOverride.expressSupressed,

                    timestamp: new Date().toISOString(),

                    metadata: newOverride.metadata

                });

            }

        }

        

        // Check station overrides

        for (const [stationCode, newOverride] of Object.entries(this.overrides.stations)) {

            const oldOverride = oldOverrides.stations[stationCode];

            if (!oldOverride) continue;

            if (newOverride.isTransferOperational !== oldOverride.isTransferOperational) {

                const lineId = this._findLineForStation(stationCode);

                changes.push({

                    type: 'isTransferOperational',

                    stationCode,

                    lineId,

                    connectedLines: this._getConnectedLines(stationCode),

                    previousState: oldOverride.isTransferOperational,

                    newState: newOverride.isTransferOperational,

                    timestamp: new Date().toISOString(),

                    metadata: newOverride.metadata

                });

            }

            

            if (newOverride.accessPointsOperational !== oldOverride.accessPointsOperational) {

                const lineId = this._findLineForStation(stationCode);

                changes.push({

                    type: 'accessPointsOperational',

                    stationCode,

                    lineId,

                    previousState: oldOverride.accessPointsOperational,

                    newState: newOverride.accessPointsOperational,

                    timestamp: new Date().toISOString(),

                    metadata: newOverride.metadata

                });

            }

        }

        

        return changes;

    }

    async _handleChanges(changes) {

        // Filter for important changes we want to announce

        const importantChanges = changes.filter(change => 

            change.type === 'isTransferOperational' || 

            change.type === 'expressSupressed' ||

            change.type === 'accessPointsOperational'

        );

        // Send notifications for each important change

        for (const change of importantChanges) {

            try {

                await this.discordBot.sendOverrideChange(change);

                logger.debug(`[StatusOverride] Discord notified about ${change.type} change`);

            } catch (error) {

                logger.error('[StatusOverride] Failed to notify Discord', {

                    error: error.message,

                    change

                });

            }

        }

        // Store all changes in history

        this._addToHistory(changes);

    }

    _findLineForStation(stationCode) {

        for (const [lineId, line] of Object.entries(this.overrides.lines)) {

            if (line.stations.includes(stationCode.toLowerCase())) {

                return lineId;

            }

        }

        return null;

    }

    _getConnectedLines(stationCode) {

        const connectedLines = new Set();

        for (const [lineId, line] of Object.entries(this.overrides.lines)) {

            if (line.stations.includes(stationCode.toLowerCase())) {

                connectedLines.add(lineId);

            }

        }

        return Array.from(connectedLines);

    }

    _addToHistory(changes) {

        this.changeHistory.unshift(...changes);

        // Keep only the last 100 changes

        if (this.changeHistory.length > 100) {

            this.changeHistory = this.changeHistory.slice(0, 100);

        }

    }

    _deepClone(obj) {

        return JSON.parse(JSON.stringify(obj));

    }

    applyOverrides(rawData) {

        if (!rawData) return rawData;

        

        // Apply line overrides

        for (const [lineId, override] of Object.entries(this.overrides.lines)) {

            if (!override.enabled || !rawData[lineId]) continue;

            

            rawData[lineId].estado = override.estado;

            if (override.mensaje) rawData[lineId].mensaje = override.mensaje;

            if (override.mensaje_app) rawData[lineId].mensaje_app = override.mensaje_app;

            if (override.expressSupressed !== undefined) {

                rawData[lineId].expressSupressed = override.expressSupressed;

            }

            

            logger.debug(`[StatusOverride] Applied override for line ${lineId}`);

        }

        

        // Apply station overrides

        for (const [stationCode, override] of Object.entries(this.overrides.stations)) {

            if (!override.enabled) continue;

            

            for (const lineData of Object.values(rawData)) {

                if (!Array.isArray(lineData.estaciones)) continue;

                

                const station = lineData.estaciones.find(s => 

                    s.codigo.toLowerCase() === stationCode.toLowerCase()

                );

                

                if (station) {

                    station.estado = override.estado;

                    if (override.descripcion) station.descripcion = override.descripcion;

                    if (override.descripcion_app) station.descripcion_app = override.descripcion_app;

                    if (override.isTransferOperational !== undefined) {

                        station.isTransferOperational = override.isTransferOperational;

                    }

                    if (override.accessPointsOperational !== undefined) {

                        station.accessPointsOperational = override.accessPointsOperational;

                    }

                    

                    logger.debug(`[StatusOverride] Applied override for station ${stationCode}`);

                }

            }

        }

        

        return rawData;

    }

    getOverrides() {

        return this._deepClone(this.overrides);

    }

    getChangeHistory() {

        return this._deepClone(this.changeHistory);

    }

    async cleanup() {

        try {

            await this.discordBot.cleanup();

            logger.info('[StatusOverride] Cleanup completed');

        } catch (error) {

            logger.error('[StatusOverride] Cleanup failed', error);

        }

    }

}

module.exports = StatusOverrideService;