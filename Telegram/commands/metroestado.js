// metroestado.js
const { Telegraf } = require('telegraf');
const metroConfig = require('../../config/metro/metroConfig');
const TimeHelpers = require('../../modules/chronos/timeHelpers');
const MetroCore = require('../../modules/metro/core/MetroCore');

// Standard emoji mapping for Metro lines (replacing Discord custom emojis)
const LINE_EMOJIS = {
    'l1': '🔴',  // Línea 1
    'l2': '🟡',  // Línea 2
    'l3': '🟤',  // Línea 3
    'l4': '🔵',  // Línea 4
    'l4a': '🔵A', // Línea 4A
    'l5': '🟢',  // Línea 5
    'l6': '🟣',  // Línea 6
    'default': '🚇' // Default emoji
};

formatTimestamp(timestamp) {
        if (!timestamp) return 'Desconocido';
        
        let fixedTimestamp = timestamp;
        if (timestamp.length > 23 && !timestamp.includes('T')) {
            fixedTimestamp = timestamp.substring(0, 10) + 'T' + timestamp.substring(11);
        }
        
        try {
            const date = new Date(fixedTimestamp);
            return date.toLocaleString('es-CL', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                timeZone: 'America/Santiago'
            });
        } catch (e) {
            return fixedTimestamp;
        }
    }

module.exports = {
    command: 'estado',
    description: 'Muestra el estado del Metro de Santiago',

    async execute(ctx) {
        try {
            // Initialize MetroCore directly
            const metro = await MetroCore.getInstance();
            
            // Get and validate raw data
            const allData = metro.api.getProcessedData();
            
            if (!allData || !allData.network) {
                throw new Error('No se pudo obtener datos del Metro');
            }

            const { network, lines = {} } = allData;
            const { summary = {} } = network;

            // Get current status information
            const currentPeriod = TimeHelpers.getCurrentPeriod();
            const isExpressActive = TimeHelpers.isExpressActive();
            const operatingHours = TimeHelpers.getOperatingHours();

            // Status mapping configuration
            const STATUS_MAP = {
                0: { emoji: '🌙', display: 'Cerrado (Fuera de horario)' },
                1: { emoji: '✅', display: 'Operativa' },
                2: { emoji: '🚧', display: 'Cerrada' },
                3: { emoji: '🔧', display: 'Servicio Parcial' },
                4: { emoji: '⚠️', display: 'Retrasos' },
                5: { emoji: '⏱️', display: 'Servicio Extendido' },
                unknown: { emoji: '❓', display: 'Estado Desconocido' }
            };

            // Build the message
            let message = `<b>🚇 Estado del Metro de Santiago</b>\n\n` +
                         `<b>Estado General:</b> ${network.status || 'Desconocido'}\n` +
                         `📝 ${summary.es?.resumen || summary.en?.summary || 'Sin información adicional'}\n\n` +
                         `⏰ <b>Período Tarifario:</b> ${currentPeriod.name}\n` +
                         `🚄 <b>Servicio Expreso:</b> ${isExpressActive ? 'ACTIVO' : 'No activo'}\n` +
                         `🕒 <b>Horario:</b> ${operatingHours.opening} - ${operatingHours.closing}` +
                         (operatingHours.isExtended ? ` (Extendido)` : '') +
                         `\n\n<b>🚇 Estado de Líneas</b>\n`;

            // Add each line status
            Object.entries(lines).forEach(([lineId, lineData]) => {
                const lineKey = lineId.toLowerCase();
                const lineEmoji = LINE_EMOJIS[lineKey] || LINE_EMOJIS.default;
                const statusCode = lineData.status?.code || '1';
                const statusInfo = STATUS_MAP[statusCode] || STATUS_MAP.unknown;
                
                const isExpressLine = metroConfig.expressLines.includes(lineKey);
                const expressIndicator = (isExpressLine && isExpressActive) ? ' 🚄' : '';
                
                const lineName = lineData.displayName || `Línea ${lineId.replace('L', '')}`;
                
                message += `\n${lineEmoji} <b>${lineName}${expressIndicator}:</b> ${statusInfo.emoji} ${statusInfo.display}`;
                
                if (lineData.status?.message) {
                    message += `\n  └ ${lineData.status.message}`;
                }
            });

            // Add timestamp
            message += `\n\n<i>Actualizado: ${formatTimestamp(network.timestamp)}</i>`;

            await ctx.replyWithHTML(message);

        } catch (error) {
            console.error('Error en comando estado:', error);
            await ctx.reply('❌ Ocurrió un error al obtener el estado del Metro. Por favor intenta nuevamente.');
        }
    },

   
    
};
