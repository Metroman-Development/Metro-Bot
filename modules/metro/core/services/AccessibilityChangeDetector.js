const axios = require('axios');
const fs = require('fs');
const path = require('path');
const TelegramBot = require('../../../../Telegram/bot');
const { getClient } = require('../../../../utils/clientManager');
const TimeHelpers = require('../../../chronos/timeHelpers');

const API_URL = process.env.ACCESSARIEL;
const STATE_FILE = path.join(__dirname, 'lastAccessState.json');
const CACHE_FILE = path.join(__dirname, 'accessibilityCache.json');
const TELEGRAM_CHANNEL = '804';
const DISCORD_CHANNEL = '1381634611225821346';

class AccessibilityChangeDetector {
    constructor() {
        this.lastStates = this.loadLastStates() || {};
        this.cachedStates = this.loadCache() || {};
        this.timeHelpers = TimeHelpers;
        this.logger = {
            info: (message) => console.log(`[INFO] ${new Date().toISOString()} - ${message}`),
            warn: (message) => console.warn(`[WARN] ${new Date().toISOString()} - ${message}`),
            error: (message) => console.error(`[ERROR] ${new Date().toISOString()} - ${message}`)
        };
    }

    loadLastStates() {
        try {
            if (fs.existsSync(STATE_FILE)) {
                const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
                this.logger.info(`Loaded last states from ${STATE_FILE}`);
                return this.cleanData(data);
            }
            this.logger.warn(`State file ${STATE_FILE} not found, starting fresh`);
            return null;
        } catch (error) {
            this.logger.error(`Error loading last states: ${error}`);
            return null;
        }
    }

    loadCache() {
        try {
            if (fs.existsSync(CACHE_FILE)) {
                const data = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
                this.logger.info(`Loaded cached states from ${CACHE_FILE}`);
                return this.cleanData(data);
            }
            this.logger.warn(`Cache file ${CACHE_FILE} not found, starting fresh`);
            return null;
        } catch (error) {
            this.logger.error(`Error loading cache: ${error.message}`);
            return null;
        }
    }

    cleanData(data) {
        const cleanData = {};
        for (const [id, equipment] of Object.entries(data)) {
            cleanData[id] = {
                time: equipment.time,
                estado: equipment.estado,
                tipo: equipment.tipo,
                estacion: equipment.estacion,
                texto: equipment.texto
            };
        }
        return cleanData;
    }

    saveLastStates(newData = null) {
        try {
            if (newData) {
                this.lastStates = newData;
            }
            const cleanData = this.cleanData(this.lastStates);
            fs.writeFileSync(STATE_FILE, JSON.stringify(cleanData, null, 2));
            this.logger.info(`Saved last states to ${STATE_FILE}`);
        } catch (error) {
            this.logger.error(`Error saving last states: ${error.message}`);
        }
    }

    saveCache(data) {
        try {
            const cleanData = this.cleanData(data);
            fs.writeFileSync(CACHE_FILE, JSON.stringify(cleanData, null, 2));
            this.logger.info(`Saved data to cache ${CACHE_FILE}`);
        } catch (error) {
            this.logger.error(`Error saving cache: ${error.message}`);
        }
    }

    isWithinUpdateWindow() {
        const currentTime = this.timeHelpers.currentTime;
        const currentHour = currentTime.hour();
        const currentMinute = currentTime.minute();
        
        // Check if within 12:18-12:30 window
        const isFirstWindow = (
            currentHour === 12 && 
            currentMinute >= 18 && 
            currentMinute <= 30
        );
        
        // Check if within 20:18-20:30 window
        const isSecondWindow = (
            currentHour === 20 && 
            currentMinute >= 18 && 
            currentMinute <= 30
        );
        
        return isFirstWindow || isSecondWindow;
    }

    async checkAccessibility() {
        try {
            const withinWindow = this.isWithinUpdateWindow();
            this.logger.info(`Starting accessibility check. Within update window: ${withinWindow}`);

            let currentStates;
            
            if (withinWindow) {
                // During update window - fetch fresh data from API
                this.logger.info('Fetching fresh data from API');
                const response = await axios.get(API_URL);
                currentStates = response.data;
                
                // Save the fresh data to cache
                this.saveCache(currentStates);
                this.logger.info('Updated cache with fresh API data');
            } else {
                // Outside update window - use cached data
                this.logger.info('Outside update window, using cached data');
                
                if (Object.keys(this.cachedStates).length === 0) {
                    this.logger.warn('No cached data available, skipping check');
                    return [];
                }
                
                currentStates = this.cachedStates;
            }

            // Clean current states data
            const cleanCurrentStates = this.cleanData(currentStates);

            // If this is the first run (empty lastStates), save the initial state
            if (Object.keys(this.lastStates).length === 0) {
                this.logger.info('First run detected, saving initial state');
                this.saveLastStates(cleanCurrentStates);
                return [];
            }
            
            // Detect changes
            const changes = this.detectChanges(cleanCurrentStates);
            this.logger.info(`Detected ${changes.length} changes`);
            
            if (changes.length > 0) {
                this.logger.info('Notifying about changes');
                await this.notifyChanges(changes);
                this.lastStates = cleanCurrentStates;
                this.saveLastStates();
            }
            
            return changes;
        } catch (error) {
            this.logger.error(`Error in accessibility check: ${error.message}`);
            return [];
        }
    }

    detectChanges(currentStates) {
        const changes = [];
        
        // Check for new or modified equipment
        for (const [equipmentId, currentData] of Object.entries(currentStates)) {
            const lastData = this.lastStates[equipmentId];
            
            if (!lastData) {
                changes.push({
                    equipmentId,
                    type: 'new',
                    current: currentData,
                });
                this.logger.info(`New equipment detected: ${equipmentId}`);
            } else if (lastData.estado !== currentData.estado) {
                changes.push({
                    equipmentId,
                    type: 'state_change',
                    previous: lastData,
                    current: currentData,
                });
                this.logger.info(`State change detected for equipment: ${equipmentId}`);
            }
        }
        
        // Check for removed equipment
        for (const equipmentId of Object.keys(this.lastStates)) {
            if (!currentStates[equipmentId]) {
                changes.push({
                    equipmentId,
                    type: 'removed',
                    previous: this.lastStates[equipmentId],
                });
                this.logger.info(`Equipment removed: ${equipmentId}`);
            }
        }
        
        return changes;
    }

    async notifyChanges(changes) {
        for (const change of changes) {
            try {
                let message = '';
                
                switch (change.type) {
                    case 'new':
                        message = `🚨 Nuevo equipo de accesibilidad detectado: ${change.equipmentId}\n` +
                                  `Tipo: ${change.current.tipo}\n` +
                                  `Estación: ${change.current.estacion}\n` +
                                  `Descripción: ${change.current.texto}\n` +
                                  `Estado inicial: ${change.current.estado === 1 ? 'Operativo ✅' : 'Fuera de servicio ❌'}`;
                        break;
                        
                    case 'state_change':
                        message = `⚠️ Cambio de estado en equipo de accesibilidad: ${change.equipmentId}\n` +
                                 `Tipo: ${change.current.tipo}\n` +
                                 `Estación: ${change.current.estacion}\n` +
                                 `Descripción: ${change.current.texto}\n` +
                                 `Cambió de: ${change.previous.estado === 1 ? 'Operativo ✅' : 'Fuera de servicio ❌'}\n` +
                                 `A: ${change.current.estado === 1 ? 'Operativo ✅' : 'Fuera de servicio ❌'}\n` +
                                 `Hora: ${change.current.time}`;
                        break;
                        
                    case 'removed':
                        message = `🚨 Equipo de accesibilidad eliminado: ${change.equipmentId}\n` +
                                 `Último tipo conocido: ${change.previous.tipo}\n` +
                                 `Estación: ${change.previous.estacion}\n` +
                                 `Último estado: ${change.previous.estado === 1 ? 'Operativo ✅' : 'Fuera de servicio ❌'}`;
                        break;
                }
                
                if (message) {
                    this.logger.info(`Sending notification for ${change.type} change: ${change.equipmentId}`);
                    await TelegramBot.sendTelegramMessage(message);
                   
                    const client = getClient();
                    const statusChannel = client.channels.cache.get(DISCORD_CHANNEL);
                    if (statusChannel) {
                        await statusChannel.send(message);
                    }
                }
            } catch (error) {
                this.logger.error(`Error notifying change for ${change.equipmentId}: ${error.message}`);
            }
        }
    }
}

module.exports = new AccessibilityChangeDetector();
