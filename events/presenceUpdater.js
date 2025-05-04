
const { ActivityType } = require('discord.js');
const logger = require('./logger');
const { randomInt } = require('crypto');
const MetroCore = require('../modules/metro/core/MetroCore');
const TimeHelpers = require('../modules/chronos/timeHelpers');
const config = require('../config/metro/metroConfig');

// Configuration - Now with dynamic weighting system
const PRESENCE_CONFIG = {
    updateInterval: 75000, // 30 seconds
    messages: {
        // All status messages in a single weighted array
        statusMessages: [
            // Time-based statuses (higher base weight)
            {
                text: (metroCore) => {
                    const next = TimeHelpers.getNextTransition();
                    return `🌙 Cierre por horario | Reapertura: ${next.time}`;
                },
                weight: 0.5,
                condition: (metroCore) => !TimeHelpers.isWithinOperatingHours(),
                boost: 2.0 // Gets double weight when active
            },
            { 
                text: () => '🚇 Hora Punta | Espere mayor Afluencia',
                weight: 0.4,
                condition: (metroCore) => {
                    const status = TimeHelpers.getServiceStatus();
                    return status.period.type === 'PUNTA' && 
                           TimeHelpers.isWithinOperatingHours() &&
                           TimeHelpers.isTimeBetween(
                               TimeHelpers.currentTime,
                               TimeHelpers.getCurrentPeriod().start,
                               TimeHelpers.getCurrentPeriod().end
                           );
                },
                boost: 1.8
            },
            {
                text: () => '🚄 Servicio Expreso activo',
                weight: 0.4,
                condition: (metroCore) => {
                    return TimeHelpers.isExpressActive() && 
                           TimeHelpers.isWithinOperatingHours() &&
                           TimeHelpers.isTimeBetween(
                               TimeHelpers.currentTime,
                               TimeHelpers.getCurrentPeriod().start,
                               TimeHelpers.getCurrentPeriod().end
                           );
                },
                boost: 1.8
            },
            {
                text: () => '🐢 Horario Bajo | Tarifa reducida',
                weight: 0.3,
                condition: (metroCore) => {
                    const status = TimeHelpers.getServiceStatus();
                    return status.period.type === 'BAJO' && 
                           TimeHelpers.isWithinOperatingHours() &&
                           TimeHelpers.isTimeBetween(
                               TimeHelpers.currentTime,
                               TimeHelpers.getCurrentPeriod().start,
                               TimeHelpers.getCurrentPeriod().end
                           );
                },
                boost: 1.5
            },
            
            // Regular status messages
            { 
                text: (metroCore) => {
                    const status = TimeHelpers.getServiceStatus();
                    return `🕒 ${status.time} | ${status.currentDay}`;
                },
                weight: 0.3,
                condition: (metroCore) => TimeHelpers.isWithinOperatingHours()
            },
            {
                text: '👀 Usa /metro info',
                weight: 0.1,
                condition: (metroCore) => TimeHelpers.isWithinOperatingHours()
            },
            {
                text: '⚠️ Precaución: Se Inicia el Cierre de Puertas',
                weight: 0.1,
                condition: (metroCore) => TimeHelpers.isWithinOperatingHours()
            },
            {
                text: (metroCore) => {
                    const station = getRandomStation(metroCore);
                    return station ? `🚉 Próxima Estación: ${station}` : 'Red Metro de Santiago';
                },
                weight: 0.2,
                condition: (metroCore) => TimeHelpers.isWithinOperatingHours()
            },
            
            // Command prompts
            {
                text: '🔍 Usa /metro planificar para ver rutas',
                weight: 0.1,
                condition: (metroCore) => TimeHelpers.isWithinOperatingHours()
            },
            {
                text: 'ℹ️ Usa /estacion info para detalles de estación',
                weight: 0.1,
                condition: (metroCore) => TimeHelpers.isWithinOperatingHours()
            },
            {
                text: '🚆 Usa /metro tren para ver detalles de los trenes',
                weight: 0.1,
                condition: (metroCore) => TimeHelpers.isWithinOperatingHours()
            },
            
            // Random phrases (lower base weight)
            {
                text: "🚇 ¡Viaja seguro!",
                weight: 0.05,
                condition: (metroCore) => TimeHelpers.isWithinOperatingHours()
            },
            {
                text: () => `⏱️ Horario Metro: ${TimeHelpers.getOperatingHours().opening} a ${TimeHelpers.getOperatingHours().closing}`,
                weight: 0.05,
                condition: (metroCore) => TimeHelpers.isWithinOperatingHours()
            },
            {
                text: "💳 Mantén cargada tu Bip!",
                weight: 0.05,
                condition: (metroCore) => TimeHelpers.isWithinOperatingHours()
            },
            {
                text: "✨ Respeta el cierre de puertas",
                weight: 0.05,
                condition: (metroCore) => TimeHelpers.isWithinOperatingHours()
            },
            {
                text: "🎧 Escucha los anuncios",
                weight: 0.05,
                condition: (metroCore) => TimeHelpers.isWithinOperatingHours()
            },
            {
                text: "🛄 Asegura tus pertenencias",
                weight: 0.05,
                condition: (metroCore) => TimeHelpers.isWithinOperatingHours()
            }, 
            {
                text: "🛗 Respeta la preferencia de los Ascensores", 
                weight: 0.05,
                condition: (metroCore) => TimeHelpers.isWithinOperatingHours()
            },
            {
                text: "🏃 Respeta el Cierre de Puertas",
                weight: 0.05,
                condition: (metroCore) => TimeHelpers.isWithinOperatingHours()
            },
            {
                text: "😵 NO PUEDO SALIR DE BAQUEDANO",
                weight: 0.05,
                condition: (metroCore) => TimeHelpers.isWithinOperatingHours()
            },
            {
                text: "🚇 Deja bajar antes de subir",
                weight: 0.05,
                condition: (metroCore) => TimeHelpers.isWithinOperatingHours()
            },
            {
                text: "🎒 Sácate la mochila antes de subir al tren",
                weight: 0.05,
                condition: (metroCore) => TimeHelpers.isWithinOperatingHours()
            },
            {
                text: "🧘 No te sientes en el piso del tren",
                weight: 0.05,
                condition: (metroCore) => TimeHelpers.isWithinOperatingHours()
            }
        ],
        
        // System messages (high priority but not exclusive)
        systemMessages: [
            {
                text: (metroCore) => {
                    const data = metroCore.api.getProcessedData();
                    if (!data) return "🔥 Calentando motores";
                    
                    // Find first line with issues
                    const problemLine = Object.values(data.lines).find(l => l.status?.code !== "1");
                    if (!problemLine) return '⚠️ Problemas en la red';
                    
                    return `⚠️ Línea ${problemLine.id.replace('l', '')} con problemas`;
                },
                weight: 0.8,
                condition: (metroCore) => {
                    const data = metroCore.api.getProcessedData();
                    if (!data) return false;
                    
                    // Check if any line has issues
                    return Object.values(data.lines).some(l => l.status?.code !== "1");
                },
                boost: 3.0
            },
            {
                text: (metroCore) => {
                    const data = metroCore.api.getProcessedData();
                    if (!data) return 'Me perdí';
                    
                    // Find first station with issues
                    const problemStation = Object.values(data.stations).find(s => s.status?.code !== "1"&&s.status?.code !== "0"&&s.status?.code !== "5");
                    if (!problemStation) return '✅️ Toda la Red Operativa';
                    
                    // Find which line it belongs to
                    const lineId = Object.keys(data.lines).find(l => 
                        data.lines[l].stations.includes(problemStation.id));
                    
                    return `⚠️ ${problemStation.displayName}${lineId ? ` (L${lineId.replace('l', '')})` : ''} afectada`;
                },
                weight: 0.8,
                condition: (metroCore) => {
                    const data = metroCore.api.getProcessedData();
                    if (!data) return false;
                    
                    // Check if any station has issues
                    return Object.values(data.stations).some(s => s.status?.code !== "1");
                },
                boost: 3.0
            },
            {
                text: '⚠️ Interrupción en la red',
                weight: 0.8,
                condition: (metroCore) => {
                    const data = metroCore.api.getProcessedData();
                    return data && (
                        Object.values(data.lines).some(l => l.status?.code !== "1") ||
                        Object.values(data.stations).some(s => s.status?.code !== "1")
                    );
                },
                boost: 2.5
            }
        ],
        
        activityTypes: [
            ActivityType.Watching,
            ActivityType.Playing,
            ActivityType.Listening,
            ActivityType.Competing
        ]
    }
};

// Helper functions remain unchanged...

function getRandomStation(metroCore) {
    try {
        const data = metroCore.api.getProcessedData();
        if (!data) {
            console.log("Sin datos de estaciones disponibles");
            return null;
        } 
        const stations = Object.values(data.stations)
            .filter(s => s.displayName && !s.displayName.includes('(Cerrada)'));
        return stations.length > 0 
            ? stations[randomInt(0, stations.length)].displayName
            : null;
    } catch (error) {
        console.error(`Error getting random station: ${error}`);
        return null;
    }
}

function getRandomActivity() {
    return PRESENCE_CONFIG.messages.activityTypes[
        randomInt(0, PRESENCE_CONFIG.messages.activityTypes.length)
    ];
}

function buildStatusMessage(metroCore) {
    try {
        // Combine all possible messages
        const allMessages = [
            ...PRESENCE_CONFIG.messages.systemMessages,
            ...PRESENCE_CONFIG.messages.statusMessages
        ];

        // Calculate dynamic weights based on conditions and boosts
        const weightedMessages = allMessages.map(msg => {
            const isActive = !msg.condition || msg.condition(metroCore);
            const effectiveWeight = isActive ? 
                (msg.weight * (msg.boost || 1.0)) : 
                (msg.weight * 0.1); // Reduce weight significantly for inactive messages
            
            return {
                text: msg.text,
                weight: effectiveWeight
            };
        });

        // Filter out messages with zero weight
        const validMessages = weightedMessages.filter(m => m.weight > 0);
        
        // Calculate total weight
        const totalWeight = validMessages.reduce((sum, m) => sum + m.weight, 0);
        
        // If no messages available (shouldn't happen), return default
        if (totalWeight <= 0) return 'Red Metro de Santiago';

        // Select message based on weights
        let random = Math.random() * totalWeight;
        for (const msg of validMessages) {
            if (random < msg.weight) {
                return typeof msg.text === 'function' ? msg.text(metroCore) : msg.text;
            }
            random -= msg.weight;
        }

        // Fallback
        return 'Red Metro de Santiago';
    } catch (error) {
        console.error(`Error building status message: ${error}`);
        return 'Red Metro de Santiago';
    }
}

function getNetworkStatus(metroCore) {
    try {
        const data = metroCore.api.getProcessedData();
        if (!data) return 'online';

        // Check for any operational issues
        const hasCriticalIssues = Object.values(data.lines).some(line => 
            line.status?.code === "3" || line.status?.code === "4"); // Major disruption or suspended
        
        const hasMinorIssues = Object.values(data.lines).some(line => 
            line.status?.code === "2") || // Partial service
            Object.values(data.stations).some(station => 
                station.status?.code !== "1");

        if (hasCriticalIssues) {
            return 'dnd'; // Do Not Disturb - red status
        } else if (hasMinorIssues) {
            return 'idle'; // Yellow status
        }
        return 'online'; // Green status
    } catch (error) {
        console.error(`Error checking network status: ${error}`);
        return 'online';
    }
}

module.exports = function initializePresenceUpdates(client, metro) {
    logger.info('🔄 Iniciando actualizaciones de presencia...');

    if (!client.metroCore) {
        logger.error('❌ MetroCore no está disponible en el cliente');
        return;
    }

    function updatePresence() {
        try {
            if (!metro.api?.getProcessedData()) {
                metro = MetroCore.getInstance();
            }
            
            const statusMessage = buildStatusMessage(metro);
            const activityType = getRandomActivity();
            
            // Determine presence status
            let presenceStatus;
            if (!TimeHelpers.isWithinOperatingHours()) {
                presenceStatus = 'idle';
            } else {
                presenceStatus = getNetworkStatus(metro);
            }
            
            client.user.setPresence({
                activities: [{
                    name: statusMessage,
                    type: activityType
                }],
                status: presenceStatus
            });
            
            logger.debug(`Presencia actualizada: "${statusMessage}" (${activityType}) [Estado: ${presenceStatus}]`);
        } catch (error) {
            logger.error(`Error al actualizar presencia: ${error.message}`);
        }
    }

    // Initial update
    updatePresence();

    // Set up regular updates
    const interval = setInterval(updatePresence, PRESENCE_CONFIG.updateInterval);

    // Cleanup
    const cleanup = () => {
        clearInterval(interval);
        logger.info('🔴 Detenidas actualizaciones de presencia');
    };

    client.once('disconnect', cleanup);
    client.once('shardDisconnect', cleanup);

    return cleanup;
};




