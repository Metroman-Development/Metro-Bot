const axios = require('axios');
const path = require('path');
const fs = require('fs').promises;

const ACCESS_API_URL = process.env.ACCESSARIEL;
const ACCESS_DETAILS_DIR = path.join(__dirname, '../../modules/metro/data/json/accessDetails');

async function getAccessConfig(stationKey, lineKey) {
    const configPath = path.join(ACCESS_DETAILS_DIR, `access_${normalizeKey(stationKey)}-${lineKey}.json`);
    try {
        const data = await fs.readFile(configPath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            return {
                elevators: [],
                escalators: [],
                accesses: [],
                changelistory: []
            };
        }
        throw error;
    }
}

function normalizeKey(str) {
    return str.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .trim();
}

async function fetchApiData() {
    try {
        const response = await axios.get(ACCESS_API_URL);
        return response.data;
    } catch (error) {
        console.error('Error fetching API data:', error);
        return {};
    }
}

function mapApiStatus(apiStatus) {
    // Map API status codes to our status strings
    const statusMap = {
        0: 'fuera de servicio',
        1: 'operativa',
        2: 'en mantención',
        3: 'restringido'
    };
    return statusMap[apiStatus] || 'operativa';
}

async function mergeApiDataWithConfig(stationCode, stationConfig) {
    const apiData = await fetchApiData();
    const mergedConfig = JSON.parse(JSON.stringify(stationConfig)); // Deep copy
    
    // Find all equipment for this station in API data
    const stationEquipment = Object.entries(apiData)
        .filter(([key, value]) => value.estacion === stationCode)
        .map(([key, value]) => ({
            id: key.split('-')[1], // Extract equipment ID
            tipo: value.tipo,
            estado: mapApiStatus(value.estado),
            lastUpdated: value.time,
            texto: value.texto
        }));
    
    // Update elevators
    if (mergedConfig.elevators) {
        mergedConfig.elevators = mergedConfig.elevators.map(elevator => {
            const apiElevator = stationEquipment.find(e => 
                e.tipo === 'ascensor' && e.id === elevator.id
            );
            if (apiElevator) {
                return {
                    ...elevator,
                    status: apiElevator.estado,
                    lastUpdated: apiElevator.lastUpdated,
                    apiData: {
                        description: apiElevator.texto,
                        historical: apiData[`${stationCode}-${elevator.id}`]?.historico
                    }
                };
            }
            return elevator;
        });
    }
    
    // Update escalators
    if (mergedConfig.escalators) {
        mergedConfig.escalators = mergedConfig.escalators.map(escalator => {
            const apiEscalator = stationEquipment.find(e => 
                e.tipo === 'escalera' && e.id === escalator.id
            );
            if (apiEscalator) {
                return {
                    ...escalator,
                    status: apiEscalator.estado,
                    lastUpdated: apiEscalator.lastUpdated,
                    apiData: {
                        description: apiEscalator.texto,
                        historical: apiData[`${stationCode}-${escalator.id}`]?.historico
                    }
                };
            }
            return escalator;
        });
    }
    
    return mergedConfig;
}

module.exports = {
    execute: async (ctx) => {
        try {
            const args = ctx.message.text.split(' ').slice(1);
            const stationName = args.join(' ');

            if (!stationName) {
                return ctx.reply('Por favor especifica una estación. Ejemplo: /accesstest Plaza de Armas');
            }

            const metro = await getMetroCore();
            const station = Object.values(metro._staticData.stations).find(s => 
                s.displayName.toLowerCase().includes(stationName.toLowerCase())
            );

            if (!station) {
                return ctx.reply('Estación no encontrada');
            }

            // Get the base config from JSON
            const baseConfig = await getAccessConfig(station.displayName, station.line);
            
            // Merge with API data
            const mergedConfig = await mergeApiDataWithConfig(station.code, baseConfig);

            // Format the response
            let message = `<b>♿ ${station.displayName} - Estado de accesibilidad</b>\n\n`;
            message += `<i>Datos combinados de configuración local y API en tiempo real</i>\n\n`;

            // Elevators status
            if (mergedConfig.elevators?.length > 0) {
                message += `<b>🛗 Ascensores:</b>\n`;
                mergedConfig.elevators.forEach(elevator => {
                    const statusEmoji = getStatusEmoji(elevator.status);
                    message += `- ${statusEmoji} ${elevator.id}: ${elevator.status}\n`;
                    if (elevator.apiData?.description) {
                        message += `  <i>${elevator.apiData.description}</i>\n`;
                    }
                    message += `  <i>Última actualización: ${formatDate(elevator.lastUpdated)}</i>\n\n`;
                });
            } else {
                message += `<b>🛗 Ascensores:</b> No configurados\n\n`;
            }

            // Escalators status
            if (mergedConfig.escalators?.length > 0) {
                message += `<b>🪜 Escaleras mecánicas:</b>\n`;
                mergedConfig.escalators.forEach(escalator => {
                    const statusEmoji = getStatusEmoji(escalator.status);
                    message += `- ${statusEmoji} ${escalator.id}: ${escalator.status}\n`;
                    if (escalator.apiData?.description) {
                        message += `  <i>${escalator.apiData.description}</i>\n`;
                    }
                    message += `  <i>Última actualización: ${formatDate(escalator.lastUpdated)}</i>\n\n`;
                });
            } else {
                message += `<b>🪜 Escaleras mecánicas:</b> No configuradas\n\n`;
            }

            // Accesses (not from API)
            if (mergedConfig.accesses?.length > 0) {
                message += `<b>🚪 Accesos:</b>\n`;
                mergedConfig.accesses.forEach(access => {
                    const statusEmoji = getStatusEmoji(access.status);
                    message += `- ${statusEmoji} ${access.id}: ${access.status} (${access.name})\n`;
                    message += `  <i>Última actualización: ${formatDate(access.lastUpdated)}</i>\n\n`;
                });
            } else {
                message += `<b>🚪 Accesos:</b> No configurados\n\n`;
            }

            await ctx.replyWithHTML(message);

        } catch (error) {
            console.error('Error in accesstest command:', error);
            ctx.reply('Ocurrió un error al obtener los datos de accesibilidad.');
        }
    }
};

// Helper functions from the original code
function getStatusEmoji(status) {
    if (!status) return '⚪';
    
    const statusMap = {
        'operativa': '🟢',
        'operativo': '🟢',
        'abierto': '🟢',
        'fuera de servicio': '🔴',
        'cerrado': '🔴',
        'en mantención': '🟡',
        'restringido': '🟡',
        'restringida': '🟡',
        'normal': '🟢',
        'alterado': '🟡',
        'suspendido': '🔴',
        'horario especial': '🟡'
    };
    
    return statusMap[status.toLowerCase()] || '⚪';
}

function formatDate(dateString) {
    if (!dateString) return 'Fecha desconocida';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-CL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

async function getMetroCore() {
    if (!metroCoreInstance) {
        metroCoreInstance = await MetroCore.getInstance();
    }
    return metroCoreInstance;
}
