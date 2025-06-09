const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { sendTelegramMessage } = require('./telegramBot');
const { sendDiscordMessage } = require('./discordBot');

const API_URL = process.env.ACCESSARIEL;
const STATE_FILE = path.join(__dirname, 'lastAccessState.json');
const TELEGRAM_CHANNEL = '804';
const DISCORD_CHANNEL = '1381634611225821346';

class AccessibilityChangeDetector {
    constructor() {
        this.lastStates = this.loadLastStates();
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
            return {};
        } catch (error) {
            console.error('Error al cargar estados anteriores:', error);
            return {};
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
        
        // Verificar equipos nuevos o modificados
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
        
        // Verificar equipos eliminados (opcional)
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
                await sendTelegramMessage(TELEGRAM_CHANNEL, message);
                await sendDiscordMessage(DISCORD_CHANNEL, message);
            }
        }
    }
}

const detector = new AccessibilityChangeDetector();

module.exports = {
    checkAccessibility: () => detector.checkAccessibility()
};
