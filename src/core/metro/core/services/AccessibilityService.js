const axios = require('axios');
const EventEmitter = require('events');
const logger = require('../../../../events/logger');
const EventRegistry = require('../../../../core/EventRegistry');
const EventPayload = require('../../../../core/EventPayload');
const DatabaseService = require('../../../database/DatabaseService');

class AccessibilityService extends EventEmitter {
    constructor(options = {}, databaseService) {
        super();
        this.timeHelpers = options.timeHelpers;
        this.config = options.config;
        this.apiUrl = process.env.ACCESSARIEL;
        this.dbService = databaseService;
        this.lastStates = {};
        this.cachedStates = {};
    }

    async initialize() {
        logger.info('[AccessibilityService] Initializing...');
        const dbStatus = await this.dbService.getAccessibilityStatus();
        for (const item of dbStatus) {
            this.lastStates[item.equipment_id] = {
                time: item.last_updated,
                estado: item.status,
                tipo: item.type,
                estacion: item.station_code,
                texto: item.text
            };
        }
        this.cachedStates = { ...this.lastStates };
        logger.info(`[AccessibilityService] Initialized with ${Object.keys(this.lastStates).length} equipment states from DB.`);
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

            if (withinWindow) {
                logger.info('[AccessibilityService] Fetching fresh data from API');
                const response = await axios.get(this.apiUrl);
                currentStates = response.data;
                this.cachedStates = this._cleanData(currentStates);
            } else {
                currentStates = this.cachedStates;
                logger.info('[AccessibilityService] Using cached data for comparison');
            }

            const cleanCurrentStates = this._cleanData(currentStates);

            const changes = this._detectChanges(cleanCurrentStates, this.lastStates);
            logger.info(`[AccessibilityService] Detected ${changes.length} changes`);

            if (changes.length > 0) {
                this.emit(EventRegistry.ACCESSIBILITY_CHANGE, new EventPayload('accessibilityChange', { changes }));
                await this.updateDatabase(changes);
                this.lastStates = cleanCurrentStates;
            }

        } catch (error) {
            logger.error(`[AccessibilityService] Error in accessibility check: ${error.message}`);
        }
    }

    async updateDatabase(changes) {
        for (const change of changes) {
            if (change.type === 'new' || change.type === 'state_change') {
                const { equipmentId, current } = change;
                const { station_code, line_id } = this.extractStationInfo(current.estacion);
                await this.dbService.updateAccessibilityStatus(equipmentId, station_code, line_id, current.estado, current.tipo, current.texto);
            } else if (change.type === 'removed') {
                await this.dbService.deleteAccessibilityStatus(change.equipmentId);
            }
        }
    }

    extractStationInfo(stationName) {
        // This is a placeholder. The station name from the API might not directly map to station_code and line_id.
        // I will assume the station name is in the format "L1 - Los Dominicos"
        const parts = stationName.split(' - ');
        if (parts.length === 2) {
            const line_id = parts[0].toLowerCase();
            // I need a mapping from station name to station code.
            // This is a known issue. I will assume the station name is the code for now.
            const station_code = parts[1].toUpperCase();
            return { line_id, station_code };
        }
        return { line_id: 'unknown', station_code: stationName.toUpperCase() };
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
}

module.exports = AccessibilityService;
