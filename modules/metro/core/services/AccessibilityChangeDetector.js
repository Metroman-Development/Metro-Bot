const axios = require('axios');
const fs = require('fs');
const path = require('path');
const TelegramBot = require('../../../../Telegram/bot');
const { getClient } = require('../../../../utils/clientManager');

const API_URL = process.env.ACCESSARIEL;
const STATE_FILE = path.join(__dirname, 'lastAccessState.json');
const TELEGRAM_CHANNEL = '804';
const DISCORD_CHANNEL = '1381634611225821346';

class AccessibilityChangeDetector {
    constructor() {
        const loadedStates = this.loadLastStates();
        // Initialize with empty object if no previous state exists
        this.lastStates = loadedStates || {};
    }

    loadLastStates() {
        try {
            if (fs.existsSync(STATE_FILE)) {
                const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
                // Remove historical data if present in loaded file
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
            return null; // Return null instead of empty object when no file exists
        } catch (error) {
            console.error('Error al cargar estados anteriores:', error);
            return null; // Return null on error
        }
    }

    saveLastStates() {
        try {
            // Ensure we only save current state without historical data
            const cleanData = {};
            for (const [id, equipment] of Object.entries(this.lastStates)) {
                cleanData[id] = {
                    time: equipment.time,
                    estado: equipment.estado,
                    tipo: equipment.tipo,
                    estacion: equipment.estacion,
                    texto: equipment.texto
                };
            }
            fs.writeFileSync(STATE_FILE, JSON.stringify(cleanData, null, 2));
        } catch (error) {
            console.error('Error al guardar estados:', error);
        }
    }

    async checkAccessibility() {
        try {
            const response = await axios.get(API_URL);
            const currentStates = response.data;
            
            // Clean historical data from current states
            const cleanCurrentStates = {};
            for (const [id, equipment] of Object.entries(currentStates)) {
                cleanCurrentStates[id] = {
                    time: equipment.time,
                    estado: equipment.estado,
                    tipo: equipment.tipo,
                    estacion: equipment.estacion,
                    texto: equipment.texto
                };
            }
            
            const changes = this.detectChanges(cleanCurrentStates);
            
            if (changes.length > 0) {
                await this.notifyChanges(changes);
                this.lastStates = cleanCurrentStates;
                this.saveLastStates();
            }
            
            return changes;
        } catch (error) {
            console.error('Error al verificar accesibilidad:', error);
            return [];
        }
    }

    detectChanges(currentStates) {
        const changes = [];
        
        // Skip detection if we have no previous state (first run)
        if (Object.keys(this.lastStates).length === 0) {
            return changes;
        }
        
        // Check for new or modified equipment
        for (const [equipmentId, currentData] of Object.entries(currentStates)) {
            const lastData = this.lastStates[equipmentId];
            
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
        
        // Check for removed equipment (optional)
        for (const equipmentId of Object.keys(this.lastStates)) {
            if (!currentStates[equipmentId]) {
                changes.push({
                    equipmentId,
                    type: 'removed',
                    previous: this.lastStates[equipmentId],
                });
            }
        }
        
        return changes;
    }

    async notifyChanges(changes) {
        for (const change of changes) {
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
                const telegramBot = TelegramBot;
                await telegramBot.sendTelegramMessage(message);
               
                const client = getClient();
                const statusChannel = client.channels.cache.get(DISCORD_CHANNEL);
                if (statusChannel) {
                    await statusChannel.send(message);
                }
            }
        }
    }
}

const detector = new AccessibilityChangeDetector();

module.exports = {
    checkAccessibility: async () => await detector.checkAccessibility()
};
