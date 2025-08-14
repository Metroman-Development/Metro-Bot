const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const EventEmitter = require('events');
const logger = require('../../../../events/logger');
const EventRegistry = require('../../../../core/EventRegistry');
const EventPayload = require('../../../../core/EventPayload');

class AccessibilityService extends EventEmitter {
    constructor(options = {}) {
        super();
        this.timeHelpers = options.timeHelpers;
        this.config = options.config;
        this.apiUrl = process.env.ACCESSARIEL;
        this.stateFile = path.join(__dirname, '../../../../data/lastAccessState.json');
        this.cacheFile = path.join(__dirname, '../../../../data/accessibilityCache.json');
        this.lastStates = {};
        this.cachedStates = {};
    }

    async initialize() {
        await this._initializeStorage();
        this.lastStates = await this._loadDataFile(this.stateFile, 'last state');
        this.cachedStates = await this._loadDataFile(this.cacheFile, 'cache');

        if (Object.keys(this.cachedStates).length === 0 && Object.keys(this.lastStates).length > 0) {
            logger.info('[AccessibilityService] Initializing cache from last state data');
            this.cachedStates = JSON.parse(JSON.stringify(this.lastStates));
            await this.saveCache(this.cachedStates);
        }
    }

    async _initializeStorage() {
        try {
            const dir = path.dirname(this.cacheFile);
            await fs.mkdir(dir, { recursive: true });
            logger.info(`[AccessibilityService] Created storage directory: ${dir}`);

            for (const file of [this.stateFile, this.cacheFile]) {
                try {
                    await fs.access(file);
                } catch {
                    await fs.writeFile(file, JSON.stringify({}, null, 2));
                    logger.info(`[AccessibilityService] Initialized empty file: ${file}`);
                }
            }
        } catch (error) {
            logger.error(`[AccessibilityService] Storage initialization failed: ${error.message}`);
            throw error;
        }
    }

    async _loadDataFile(filePath, type) {
        try {
            const data = JSON.parse(await fs.readFile(filePath, 'utf8'));

            if (typeof data !== 'object' || data === null) {
                throw new Error(`Invalid ${type} file structure`);
            }

            logger.info(`[AccessibilityService] Loaded ${type} data from ${filePath}`);
            return this._cleanData(data);
        } catch (error) {
            logger.error(`[AccessibilityService] Error loading ${type} data: ${error.message}`);

            if (error instanceof SyntaxError) {
                const backupPath = `${filePath}.bak`;
                await fs.copyFile(filePath, backupPath);
                logger.warn(`[AccessibilityService] Created backup of corrupted file at ${backupPath}`);
            }

            return {};
        }
    }

    _cleanData(data) {
        const cleanData = {};
        for (const [id, equipment] of Object.entries(data)) {
            if (!equipment || typeof equipment !== 'object') continue;

            cleanData[id] = {
                time: equipment.time || this.timeHelpers.currentTime.toISOString(),
                estado: equipment.estado !== undefined ? equipment.estado : -1,
                tipo: equipment.tipo || 'unknown',
                estacion: equipment.estacion || 'unknown',
                texto: equipment.texto || 'No description'
            };
        }
        return cleanData;
    }

    async saveLastStates(newData = null) {
        try {
            if (newData) {
                this.lastStates = newData;
            }
            const cleanData = this._cleanData(this.lastStates);
            await fs.writeFile(this.stateFile, JSON.stringify(cleanData, null, 2));
            logger.info(`[AccessibilityService] Saved last states to ${this.stateFile}`);
        } catch (error) {
            logger.error(`[AccessibilityService] Error saving last states: ${error.message}`);
        }
    }

    async saveCache(data) {
        try {
            const cleanData = this._cleanData(data);
            await fs.writeFile(this.cacheFile, JSON.stringify(cleanData, null, 2));
            this.cachedStates = cleanData;
            logger.info(`[AccessibilityService] Updated cache at ${this.cacheFile}`);
        } catch (error) {
            logger.error(`[AccessibilityService] Error saving cache: ${error.message}`);
        }
    }

    isWithinUpdateWindow() {
        const currentTime = this.timeHelpers.currentTime;
        const currentHour = currentTime.hour();
        const currentMinute = currentTime.minute();

        const windows = [
            { hour: 6, start: 20, end: 25 },
            { hour: 9, start: 20, end: 24 },
            { hour: 12, start: 48, end: 51 },
            { hour: 16, start: 10, end: 15 },
            { hour: 20, start: 40, end: 45 }
        ];

        return windows.some(w => currentHour === w.hour && currentMinute >= w.start && currentMinute <= w.end);
    }

    async checkAccessibility() {
        try {
            const withinWindow = this.isWithinUpdateWindow();
            logger.info(`[AccessibilityService] Starting accessibility check. Within update window: ${withinWindow}`);

            let currentStates;
            let comparisonBaseline;

            if (withinWindow) {
                logger.info('[AccessibilityService] Fetching fresh data from API');
                const response = await axios.get(this.apiUrl);
                currentStates = response.data;
                comparisonBaseline = this.lastStates;
                await this.saveCache(currentStates);
            } else {
                if (Object.keys(this.cachedStates).length > 0) {
                    currentStates = this.cachedStates;
                    comparisonBaseline = this.lastStates;
                    logger.info('[AccessibilityService] Using cached data for comparison');
                } else {
                    logger.error('[AccessibilityService] No cached data available');
                    return;
                }
            }

            const cleanCurrentStates = this._cleanData(currentStates);
            const cleanComparisonBaseline = this._cleanData(comparisonBaseline);

            if (Object.keys(cleanComparisonBaseline).length === 0) {
                logger.info('[AccessibilityService] First run detected, saving initial state');
                await this.saveLastStates(cleanCurrentStates);
                return;
            }

            const changes = this._detectChanges(cleanCurrentStates, cleanComparisonBaseline);
            logger.info(`[AccessibilityService] Detected ${changes.length} changes`);

            if (changes.length > 0) {
                this.emit(EventRegistry.ACCESSIBILITY_CHANGE, new EventPayload('accessibilityChange', { changes }));
                logger.info('[AccessibilityService] Updating lastStates with current data');
                await this.saveLastStates(cleanCurrentStates);
            }

            this.cachedStates = await this._loadDataFile(this.cacheFile, 'cache');

        } catch (error) {
            logger.error(`[AccessibilityService] Error in accessibility check: ${error.message}`);
        }
    }

    _detectChanges(currentStates, comparisonBaseline) {
        const changes = [];

        for (const [equipmentId, currentData] of Object.entries(currentStates)) {
            const lastData = comparisonBaseline[equipmentId];

            if (!lastData) {
                changes.push({
                    equipmentId,
                    type: 'new',
                    current: currentData,
                });
            } else if (lastData.estado !== currentData.estado) {
                changes.push({
                    equipmentId,
                    type: 'state_change',
                    previous: lastData,
                    current: currentData,
                });
            }
        }

        for (const equipmentId of Object.keys(comparisonBaseline)) {
            if (!currentStates[equipmentId]) {
                changes.push({
                    equipmentId,
                    type: 'removed',
                    previous: comparisonBaseline[equipmentId],
                });
            }
        }

        return changes;
    }
}

module.exports = AccessibilityService;
