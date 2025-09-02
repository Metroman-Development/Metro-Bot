const { ActivityType } = require('discord.js');
const logger = require('../../events/logger');
const { randomInt } = require('crypto');
const TimeHelpers = require('../../utils/timeHelpers');

// Configuration - Now with dynamic weighting system
const PRESENCE_CONFIG = {
    messages: {
        // All status messages in a single weighted array
        statusMessages: [
            // Time-based statuses (higher base weight)
            {
                text: (metroInfoProvider) => {
                    const next = TimeHelpers.getNextTransition();
                    return `🌙 Cierre por horario | Reapertura: ${next.time}`;
                },
                weight: 0.5,
                condition: (metroInfoProvider) => !TimeHelpers.isWithinOperatingHours(),
                boost: 2.0 // Gets double weight when active
            },
            {
                text: () => '🚇 Hora Punta | Espere mayor Afluencia',
                weight: 0.4,
                condition: (metroInfoProvider) => {
                    const period = TimeHelpers.getCurrentPeriod();
                    return period.type === 'PUNTA' &&
                           TimeHelpers.isWithinOperatingHours();
                },
                boost: 1.8
            },
            {
                text: () => '🚄 Servicio Expreso activo',
                weight: 0.4,
                condition: (metroInfoProvider) => {
                    return TimeHelpers.isExpressActive() &&
                           TimeHelpers.isWithinOperatingHours();
                },
                boost: 1.8
            },
            {
                text: () => '🐢 Horario Bajo | Tarifa reducida',
                weight: 0.3,
                condition: (metroInfoProvider) => {
                    const period = TimeHelpers.getCurrentPeriod();
                    return period.type === 'BAJO' &&
                           TimeHelpers.isWithinOperatingHours();
                },
                boost: 1.5
            },

            // Regular status messages
            {
                text: (metroInfoProvider) => {
                    const time = TimeHelpers.currentTime.format('HH:mm');
                    const day = TimeHelpers.currentTime.format('dddd');
                    return `🕒 ${time} | ${day}`;
                },
                weight: 0.3,
                condition: (metroInfoProvider) => TimeHelpers.isWithinOperatingHours()
            },
            {
                text: '👀 Usa /metro info',
                weight: 0.1,
                condition: (metroInfoProvider) => TimeHelpers.isWithinOperatingHours()
            },
            {
                text: '⚠️ Precaución: Se Inicia el Cierre de Puertas',
                weight: 0.1,
                condition: (metroInfoProvider) => TimeHelpers.isWithinOperatingHours()
            },
            {
                text: (metroInfoProvider) => {
                    const station = getRandomStation(metroInfoProvider);
                    return station ? `🚉 Próxima Estación: ${station}` : 'Red Metro de Santiago';
                },
                weight: 0.2,
                condition: (metroInfoProvider) => TimeHelpers.isWithinOperatingHours()
            },

            // Command prompts
            {
                text: '🔍 Usa /metro planificar para ver rutas',
                weight: 0.1,
                condition: (metroInfoProvider) => TimeHelpers.isWithinOperatingHours()
            },
            {
                text: 'ℹ️ Usa /estacion info para detalles de estación',
                weight: 0.1,
                condition: (metroInfoProvider) => TimeHelpers.isWithinOperatingHours()
            },
            {
                text: '🚆 Usa /metro tren para ver detalles de los trenes',
                weight: 0.1,
                condition: (metroInfoProvider) => TimeHelpers.isWithinOperatingHours()
            },

            // Random phrases (lower base weight)
            {
                text: "🚇 ¡Viaja seguro!",
                weight: 0.05,
                condition: (metroInfoProvider) => TimeHelpers.isWithinOperatingHours()
            },
            {
                text: () => `⏱️ Horario Metro: ${TimeHelpers.getOperatingHours().opening} a ${TimeHelpers.getOperatingHours().closing}`,
                weight: 0.05,
                condition: (metroInfoProvider) => TimeHelpers.isWithinOperatingHours()
            },
            {
                text: "💳 Mantén cargada tu Bip!",
                weight: 0.05,
                condition: (metroInfoProvider) => TimeHelpers.isWithinOperatingHours()
            },
            {
                text: "✨ Respeta el cierre de puertas",
                weight: 0.05,
                condition: (metroInfoProvider) => TimeHelpers.isWithinOperatingHours()
            },
            {
                text: "🎧 Escucha los anuncios",
                weight: 0.05,
                condition: (metroInfoProvider) => TimeHelpers.isWithinOperatingHours()
            },
            {
                text: "🛄 Asegura tus pertenencias",
                weight: 0.05,
                condition: (metroInfoProvider) => TimeHelpers.isWithinOperatingHours()
            },
            {
                text: "🛗 Respeta la preferencia de los Ascensores",
                weight: 0.05,
                condition: (metroInfoProvider) => TimeHelpers.isWithinOperatingHours()
            },
            {
                text: "🏃 Respeta el Cierre de Puertas",
                weight: 0.05,
                condition: (metroInfoProvider) => TimeHelpers.isWithinOperatingHours()
            },
            {
                text: "😵 NO PUEDO SALIR DE BAQUEDANO",
                weight: 0.05,
                condition: (metroInfoProvider) => TimeHelpers.isWithinOperatingHours()
            },
            {
                text: "🚇 Deja bajar antes de subir",
                weight: 0.05,
                condition: (metroInfoProvider) => TimeHelpers.isWithinOperatingHours()
            },
            {
                text: "🎒 Sácate la mochila antes de subir al tren",
                weight: 0.05,
                condition: (metroInfoProvider) => TimeHelpers.isWithinOperatingHours()
            },
            {
                text: "🧘 No te sientes en el piso del tren",
                weight: 0.05,
                condition: (metroInfoProvider) => TimeHelpers.isWithinOperatingHours()
            }
        ],

        // System messages (high priority but not exclusive)
        systemMessages: [
            {
                text: (metroInfoProvider) => {
                    const data = metroInfoProvider.getFullData();
                    if (!data || !data.lines) return "🔥 Calentando motores";

                    // Find first line with issues
                    const problemLine = Object.values(data.lines).find(l => l.status?.code !== "1");
                    if (!problemLine) return '⚠️ Problemas en la red';

                    return `⚠️ Línea ${problemLine.id.replace('l', '')} con problemas`;
                },
                weight: 0.8,
                condition: (metroInfoProvider) => {
                    const data = metroInfoProvider.getFullData();
                    if (!data || !data.lines) return false;

                    // Check if any line has issues
                    return Object.values(data.lines).some(l => l.status?.code !== "1");
                },
                boost: 3.0
            },
            {
                text: (metroInfoProvider) => {
                    const data = metroInfoProvider.getFullData();
                    if (!data || !data.stations) return 'Me perdí';

                    // Find first station with issues
                    const problemStation = Object.values(data.stations).find(s => s.status?.code !== "1"&&s.status?.code !== "0"&&s.status?.code !== "5");
                    if (!problemStation) return '✅️ Toda la Red Operativa';

                    // Find which line it belongs to
                    const lineId = Object.keys(data.lines).find(l =>
                        data.lines[l].stations.includes(problemStation.id));

                    return `⚠️ ${problemStation.displayName}${lineId ? ` (L${lineId.replace('l', '')})` : ''} afectada`;
                },
                weight: 0.8,
                condition: (metroInfoProvider) => {
                    const data = metroInfoProvider.getFullData();
                    if (!data || !data.stations) return false;

                    // Check if any station has issues
                    return Object.values(data.stations).some(s => s.status?.code !== "1");
                },
                boost: 3.0
            },
            {
                text: '⚠️ Interrupción en la red',
                weight: 0.8,
                condition: (metroInfoProvider) => {
                    const data = metroInfoProvider.getFullData();
                    return data && data.lines && data.stations && (
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

function getRandomStation(metroInfoProvider) {
    try {
        const data = metroInfoProvider.getFullData();
        if (!data || !data.stations) {
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

function buildStatusMessage(metroInfoProvider) {
    try {
        // Combine all possible messages
        const allMessages = [
            ...PRESENCE_CONFIG.messages.systemMessages,
            ...PRESENCE_CONFIG.messages.statusMessages
        ];

        // Calculate dynamic weights based on conditions and boosts
        const weightedMessages = allMessages.map(msg => {
            const isActive = !msg.condition || msg.condition(metroInfoProvider);
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
                return typeof msg.text === 'function' ? msg.text(metroInfoProvider) : msg.text;
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

function getNetworkStatus(metroInfoProvider) {
    try {
        const data = metroInfoProvider.getFullData();
        if (!data || !data.lines || !data.stations) return 'online';

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

async function updatePresence(client, metroInfoProvider) {
    try {
        if (!client || !client.isReady()) {
            logger.info('Discord client not ready, skipping presence update.');
            return;
        }

        const statusMessage = buildStatusMessage(metroInfoProvider);
        const activityType = getRandomActivity();

        // Determine presence status
        let presenceStatus;
        if (!TimeHelpers.isWithinOperatingHours()) {
            presenceStatus = 'idle';
        } else {
            presenceStatus = getNetworkStatus(metroInfoProvider);
        }

        await client.user.setPresence({
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

module.exports = {
    updatePresence,
};
