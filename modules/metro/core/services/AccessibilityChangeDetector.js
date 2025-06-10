const axios = require('axios');
const fs = require('fs');
const path = require('path');
const TelegramBot = require('../../../../Telegram/bot');
const { getClient } = require('../../../../utils/clientManager');
const TimeHelpers = require('../../../chronos/timeHelpers');
const { EmbedBuilder } = require('discord.js');
const metroConfig = require('../../../../config/metro/metroConfig');

const API_URL = process.env.ACCESSARIEL; // Ensure this is set in your environment
const STATE_FILE = path.join(__dirname, 'lastAccessState.json');
const CACHE_FILE = path.join(__dirname, 'accessibilityCache.json');
const TELEGRAM_CHANNEL = '804';
const DISCORD_CHANNEL = '1381634611225821346';

// MetroCore instance management (singleton pattern)
let metroCoreInstance = null;
async function getMetroCore() {
    if (!metroCoreInstance) {
        const MetroCore = require('../MetroCore');
        metroCoreInstance = await MetroCore.getInstance();
    }
    return metroCoreInstance;
}

class AccessibilityChangeDetector {
    constructor() {
        this.logger = {
            info: (message) => console.log(`[INFO] ${new Date().toISOString()} - ${message}`),
            warn: (message) => console.warn(`[WARN] ${new Date().toISOString()} - ${message}`),
            error: (message) => console.error(`[ERROR] ${new Date().toISOString()} - ${message}`)
        };

        this.initializeStorage();
        this.lastStates = this.loadDataFile(STATE_FILE, 'last state');
        this.cachedStates = this.loadDataFile(CACHE_FILE, 'cache');

        if (Object.keys(this.cachedStates).length === 0 && Object.keys(this.lastStates).length > 0) {
            this.logger.info('Initializing cache from last state data');
            this.cachedStates = JSON.parse(JSON.stringify(this.lastStates));
            this.saveCache(this.cachedStates);
        }

        this.timeHelpers = TimeHelpers;
    }

    initializeStorage() {
        try {
            const dir = path.dirname(CACHE_FILE);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
                this.logger.info(`Created storage directory: ${dir}`);
            }

            [STATE_FILE, CACHE_FILE].forEach(file => {
                if (!fs.existsSync(file)) {
                    fs.writeFileSync(file, JSON.stringify({}, null, 2));
                    this.logger.info(`Initialized empty file: ${file}`);
                }
            });
        } catch (error) {
            this.logger.error(`Storage initialization failed: ${error.message}`);
            throw error;
        }
    }

    loadDataFile(filePath, type) {
        try {
            const rawData = fs.readFileSync(filePath, 'utf8');
            const data = JSON.parse(rawData);
            
            if (typeof data !== 'object' || data === null) {
                throw new Error(`Invalid ${type} file structure`);
            }

            this.logger.info(`Loaded ${type} data from ${filePath}`);
            return this.cleanData(data);
        } catch (error) {
            this.logger.error(`Error loading ${type} data: ${error.message}`);
            
            if (fs.existsSync(filePath) && error instanceof SyntaxError) {
                const backupPath = `${filePath}.bak`;
                fs.copyFileSync(filePath, backupPath);
                this.logger.warn(`Created backup of corrupted file at ${backupPath}`);
            }

            return {};
        }
    }

    cleanData(data) {
        const cleanData = {};
        for (const [id, equipment] of Object.entries(data)) {
            if (!equipment || typeof equipment !== 'object') continue;
            
            cleanData[id] = {
                time: equipment.time || new Date().toISOString(),
                estado: equipment.estado !== undefined ? equipment.estado : -1,
                tipo: equipment.tipo || 'unknown',
                estacion: equipment.estacion || 'unknown',
                texto: equipment.texto || 'No description'
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
            this.cachedStates = cleanData;
            this.logger.info(`Updated cache at ${CACHE_FILE}`);
        } catch (error) {
            this.logger.error(`Error saving cache: ${error.message}`);
        }
    }

    isWithinUpdateWindow() {
        const currentTime = this.timeHelpers.currentTime;
        const currentHour = currentTime.hour();
        const currentMinute = currentTime.minute();
        
        const isFirstWindow = (
            currentHour === 12 && 
            currentMinute >= 20 && 
            currentMinute <= 24
        );
        
        const isSecondWindow = (
            currentHour === 20 && 
            currentMinute >= 20 && 
            currentMinute <= 24
        );
        
        return isFirstWindow || isSecondWindow;
    }

    async checkAccessibility() {
    try {
        const withinWindow = this.isWithinUpdateWindow();
        this.logger.info(`Starting accessibility check. Within update window: ${withinWindow}`);

        let currentStates;
        let dataSource;
        let comparisonBaseline;
        
        if (withinWindow) {
            // During window: fetch live API data
            this.logger.info('Fetching fresh data from API');
            const response = await axios.get(API_URL);
            currentStates = response.data;
            dataSource = 'API';
            comparisonBaseline = this.lastStates;
            this.saveCache(currentStates);
        } else {
            // Outside window: use cached data
            if (Object.keys(this.cachedStates).length > 0) {
                currentStates = this.cachedStates;
                comparisonBaseline = this.lastStates;
                dataSource = 'cache';
                this.logger.info('Using cached data for comparison');
            } else {
                this.logger.error('No cached data available');
                return [];
            }
        }

        const cleanCurrentStates = this.cleanData(currentStates);
        const cleanComparisonBaseline = this.cleanData(comparisonBaseline);

        if (Object.keys(cleanComparisonBaseline).length === 0) {
            this.logger.info('First run detected, saving initial state');
            this.saveLastStates(cleanCurrentStates);
            return [];
        }
        
        const changes = this.detectChanges(cleanCurrentStates, cleanComparisonBaseline);
        this.logger.info(`Detected ${changes.length} changes`);

        if (changes.length > 0) {
            await this.notifyChanges(changes);
            
            // Always update lastStates when changes are detected
            this.logger.info('Updating lastStates with current data');
            this.saveLastStates(cleanCurrentStates);
        }

        this.cachedStates = this.loadDataFile(CACHE_FILE, 'cache');
        
        return changes;
    } catch (error) {
        this.logger.error(`Error in accessibility check: ${error.message}`);
        return [];
    }
}

    detectChanges(currentStates, comparisonBaseline) {
        const changes = [];
        
        for (const [equipmentId, currentData] of Object.entries(currentStates)) {
            const lastData = comparisonBaseline[equipmentId];
            
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
        
        for (const equipmentId of Object.keys(comparisonBaseline)) {
            if (!currentStates[equipmentId]) {
                changes.push({
                    equipmentId,
                    type: 'removed',
                    previous: comparisonBaseline[equipmentId],
                });
                this.logger.info(`Equipment removed: ${equipmentId}`);
            }
        }
        
        return changes;
    }

    async formatAccessibilityNotification(changes) {
        if (!changes || changes.length === 0) return null;

        const metro = await getMetroCore();
        const groupedChanges = changes.reduce((acc, change) => {
            const stationCode = change.equipmentId.split('-')[0];
            const station = Object.values(metro._staticData.stations).find(s => 
                s.code === stationCode
            );
            
            const line = station?.line ? `Línea ${station.line}` : 'Desconocida';
            const stationName = station?.displayName || stationCode;
            
            if (!acc[line]) acc[line] = {};
            if (!acc[line][stationName]) acc[line][stationName] = [];
            
            acc[line][stationName].push(change);
            return acc;
        }, {});

        let message = `♿ *Actualización de Accesibilidad* ♿\n\n`;

        for (const [line, stations] of Object.entries(groupedChanges)) {
            message += `*${line}*\n`;
            
            for (const [stationName, stationChanges] of Object.entries(stations)) {
                message += `*${stationName}*\n`;
                
                const typeGroups = stationChanges.reduce((acc, change) => {
                    const type = change.current?.tipo || change.previous?.tipo || 'Equipo';
                    if (!acc[type]) acc[type] = [];
                    acc[type].push(change);
                    return acc;
                }, {});

                for (const [type, typeChanges] of Object.entries(typeGroups)) {
                    message += `_${type}_\n`;
                    
                    for (const change of typeChanges) {
                        if (change.type === 'new') {
                            message += `➕ Nuevo: ${change.current.texto} - `;
                            message += `Estado: ${change.current.estado === 1 ? '✅ Operativo' : '❌ Fuera de servicio'}\n`;
                        } else if (change.type === 'state_change') {
                            message += `🔄 Cambio: ${change.current.texto}\n`;
                            message += `- De: ${change.previous.estado === 1 ? '✅ Operativo' : '❌ Fuera de servicio'}\n`;
                            message += `- A: ${change.current.estado === 1 ? '✅ Operativo' : '❌ Fuera de servicio'}\n`;
                        } else if (change.type === 'removed') {
                            message += `➖ Eliminado: ${change.current?.texto || 'Equipo desconocido'}\n`;
                        }
                    }
                }
                message += '\n';
            }
            message += '\n';
        }

        message += `_Actualizado: ${new Date().toLocaleString('es-CL')}_`;
        return message;
    }

    async notifyChanges(changes) {
        try {
            const message = await this.formatAccessibilityNotification(changes);
            if (!message) return;

            this.logger.info('Sending accessibility notification');
            
            // Telegram message (unchanged)
            await TelegramBot.sendTelegramMessage(message, { parse_mode: 'Markdown' });
            
            // Enhanced Discord message
            const client = getClient();
            const statusChannel = client.channels.cache.get(DISCORD_CHANNEL);
            if (statusChannel) {
                const metro = await getMetroCore();
                
                // Create embed
                const embed = new EmbedBuilder()
                    .setColor(0x0052A5) // Metro blue color
                    .setTitle(`${metroConfig.accessibility.logo} Actualización de Accesibilidad ${metroConfig.accessibility.logo}`)
                    .setTimestamp()
                    .setFooter({ text: `Actualizado: ${new Date().toLocaleString('es-CL')}` });

                // Process changes for Discord
                const groupedChanges = changes.reduce((acc, change) => {
                    const stationCode = change.equipmentId.split('-')[0];
                    const station = Object.values(metro._staticData.stations).find(s => 
                        s.code === stationCode
                    );
                    
                    const lineKey = station?.line ? `l${station.line}` : 'unknown';
                    const lineEmoji = metroConfig.linesEmojis[lineKey] || '';
                    const lineDisplay = lineEmoji ? `${lineEmoji} Línea ${station.line}` : `Línea ${station.line}`;
                    
                    const stationName = station?.displayName || stationCode;
                    
                    if (!acc[lineDisplay]) acc[lineDisplay] = {};
                    if (!acc[lineDisplay][stationName]) acc[lineDisplay][stationName] = [];
                    
                    acc[lineDisplay][stationName].push(change);
                    return acc;
                }, {});

                // Add fields to embed
                for (const [line, stations] of Object.entries(groupedChanges)) {
                    let stationMessages = [];
                    
                    for (const [stationName, stationChanges] of Object.entries(stations)) {
                        let changeMessages = [];
                        
                        const typeGroups = stationChanges.reduce((acc, change) => {
                            const type = change.current?.tipo || change.previous?.tipo || 'Equipo';
                            if (!acc[type]) acc[type] = [];
                            acc[type].push(change);
                            return acc;
                        }, {});

                        for (const [type, typeChanges] of Object.entries(typeGroups)) {
                            let typeMessage = `**${type}**\n`;
                            
                            for (const change of typeChanges) {
                                if (change.type === 'new') {
                                    const statusEmoji = change.current.estado === 1 ? 
                                        metroConfig.accessibility.estado.ope : 
                                        metroConfig.accessibility.estado.fes;
                                    typeMessage += `➕ Nuevo: ${change.current.texto} - `;
                                    typeMessage += `Estado: ${statusEmoji} ${change.current.estado === 1 ? 'Operativo' : 'Fuera de servicio'}\n`;
                                } else if (change.type === 'state_change') {
                                    const prevStatus = change.previous.estado === 1 ? 
                                        metroConfig.accessibility.estado.ope : 
                                        metroConfig.accessibility.estado.fes;
                                    const currStatus = change.current.estado === 1 ? 
                                        metroConfig.accessibility.estado.ope : 
                                        metroConfig.accessibility.estado.fes;
                                    typeMessage += `🔄 Cambio: ${change.current.texto}\n`;
                                    typeMessage += `- De: ${prevStatus} ${change.previous.estado === 1 ? 'Operativo' : 'Fuera de servicio'}\n`;
                                    typeMessage += `- A: ${currStatus} ${change.current.estado === 1 ? 'Operativo' : 'Fuera de servicio'}\n`;
                                } else if (change.type === 'removed') {
                                    typeMessage += `➖ Eliminado: ${change.current?.texto || 'Equipo desconocido'}\n`;
                                }
                            }
                            changeMessages.push(typeMessage);
                        }
                        
                        stationMessages.push(`**${stationName}**\n${changeMessages.join('\n')}`);
                    }
                    
                    embed.addFields({
                        name: line,
                        value: stationMessages.join('\n\n'),
                        inline: false
                    });
                }

                await statusChannel.send({ embeds: [embed] });
            }
        } catch (error) {
            this.logger.error(`Error notifying changes: ${error.message}`);
        }
    }
}

module.exports = new AccessibilityChangeDetector();
