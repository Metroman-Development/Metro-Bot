const { Markup } = require('telegraf');
const TimeHelpers = require('../../modules/chronos/timeHelpers');
const metroConfig = require('../../config/metro/metroConfig');

// Spanish day names mapping
const spanishDays = {
    'weekday': 'Día hábil',
    'saturday': 'Sábado',
    'sunday': 'Domingo',
    'festive': 'Feriado'
};

// Telegram-friendly line emojis
const lineEmojis = {
    'l1': '🔴', // Red
    'l2': '🟡', // Yellow
    'l5': '🟢', // Dark Green
    'l4': '🔵', // Blue
    'l4A': '🔷', // Purple
    'l3': '🟤', // Orange
    'l6': '🟣'  // White
};

// Period configuration
const periodConfig = {
    'PUNTA': { 
        emoji: '🚨', 
        name: 'Hora Punta',
        icon: '⏰' 
    },
    'VALLE': { 
        emoji: '🟢', 
        name: 'Horario Normal',
        icon: '🟢' 
    },
    'BAJO': { 
        emoji: '🔵', 
        name: 'Horario Bajo',
        icon: '🔷' 
    },
    'NOCHE': { 
        emoji: '🌙', 
        name: 'Fuera de Servicio',
        icon: '🌃' 
    }
};

// Utility function to get random emoji
function getRandomEmoji() {
    const emojis = ['✨', '⚡', '🌀', '🌙', '🌟'];
    return emojis[Math.floor(Math.random() * emojis.length)];
}

// Safe message editing with error handling
async function safeEditMessage(ctx, message, keyboard) {
    try {
        // Add a timestamp or random emoji to ensure the message is always different
        const timestamp = new Date().toLocaleTimeString();
            // Add a small non-visible difference
        message += `\n${timestamp}`;
        // Add subtle variation to prevent "message not modified" errors
        const variedMessage = `${message}`;
        
        await ctx.editMessageText(variedMessage, {
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: keyboard }
        });
        return true;
    } catch (error) {
        if (error.description && error.description.includes('message is not modified')) {
            await ctx.answerCbQuery('✅ La información ya está actualizada');
            return false;
        }
        
        if (error.description && error.description.includes('message to edit not found')) {
            await ctx.replyWithHTML(message, {
                reply_markup: { inline_keyboard: keyboard }
            });
            return false;
        }
        
        console.error('Error editing message:', error);
        await ctx.answerCbQuery('⚠️ Error al actualizar, intenta nuevamente');
        return false;
    }
}

module.exports = {
    execute: async (ctx) => {
        try {
            // Rate limiting for quick repeated commands
            if (ctx.callbackQuery && Date.now() - ctx.callbackQuery.message.date * 1000 < 500) {
                await ctx.answerCbQuery();
                return;
            }

            const args = ctx.message?.text?.split(' ').slice(1) || [];
            const [action] = args;

            if (!action) {
                return showMainMenu(ctx);
            }

            switch (action.toLowerCase()) {
                case 'periodo':
                case 'estado':
                    return showPeriodInfo(ctx);
                case 'regular':
                case 'horario':
                    return showRegularSchedule(ctx);
                case 'periodos':
                    return showPeriodosInfo(ctx);
                default:
                    return showMainMenu(ctx);
            }
        } catch (error) {
            console.error('Error in /horarios command:', error);
            handleError(ctx, error);
        }
    },

    registerActions: (bot) => {
        // Main menu actions
        bot.action('horarios_main', async (ctx) => {
            try {
                await ctx.answerCbQuery();
                await showMainMenu(ctx);
            } catch (error) {
                console.error('Error in horarios_main action:', error);
                await ctx.answerCbQuery('⚠️ Error, intenta nuevamente');
            }
        });

        // Period info action
        bot.action('horarios_periodo', async (ctx) => {
            try {
                await ctx.answerCbQuery();
                await showPeriodInfo(ctx);
            } catch (error) {
                console.error('Error in horarios_periodo action:', error);
                await ctx.answerCbQuery('⚠️ Error al mostrar período');
            }
        });

        // Regular schedule action
        bot.action('horarios_regular', async (ctx) => {
            try {
                await ctx.answerCbQuery();
                await showRegularSchedule(ctx);
            } catch (error) {
                console.error('Error in horarios_regular action:', error);
                await ctx.answerCbQuery('⚠️ Error al mostrar horarios');
            }
        });

        // Periodos info action
        bot.action('periodos_info', async (ctx) => {
            try {
                await ctx.answerCbQuery();
                await showPeriodosInfo(ctx);
            } catch (error) {
                console.error('Error in periodos_info action:', error);
                await ctx.answerCbQuery('⚠️ Error al mostrar periodos');
            }
        });
    }
};

// Main menu with summary
async function showMainMenu(ctx) {
    try {
        // Get current info for summary
        const period = TimeHelpers.getCurrentPeriod();
        const currentPeriod = periodConfig[period.type] || periodConfig.VALLE;
        const hours = TimeHelpers.getOperatingHours();
        
        let message = `🚇 <b>Menú de Horarios del Metro</b> ${getRandomEmoji()}\n\n`;
        message += `<b>Resumen Actual:</b>\n`;
        message += `• ${currentPeriod.icon} ${currentPeriod.name}\n`;
        message += `• 🕒 ${hours.opening} - ${hours.closing}\n`;
        message += `• 📅 ${spanishDays[TimeHelpers.getDayType()] || 'Día hábil'}\n\n`;
        message += `Selecciona la información que deseas ver:`;
        
        const keyboard = [
            [Markup.button.callback('⏰ Período Operacional Completo', 'horarios_periodo')],
            [Markup.button.callback('📅 Horarios Regulares', 'horarios_regular')],
            [Markup.button.callback('💰 Periodos Tarifarios', 'periodos_info')]
        ];

        if (ctx.callbackQuery) {
            await safeEditMessage(ctx, message, keyboard);
        } else {
            await ctx.replyWithHTML(message, {
                reply_markup: { inline_keyboard: keyboard }
            });
        }
    } catch (error) {
        handleError(ctx, error, 'mostrar menú principal');
    }
}

// Show current period info
async function showPeriodInfo(ctx) {
    try {
        // Get current period and operating info
        const period = TimeHelpers.getCurrentPeriod();
        const hours = TimeHelpers.getOperatingHours();
        const dayType = spanishDays[TimeHelpers.getDayType()] || 'Día hábil';
        
        // Get current fare based on period
        const fareKey = `t_metro_${period.type.toLowerCase()}`;
        const currentFare = metroConfig.tarifario[fareKey] || '790';
        
        const currentPeriod = periodConfig[period.type] || periodConfig.VALLE;
        
        let message = `<b>${currentPeriod.icon} ${currentPeriod.name} ${currentPeriod.emoji}</b>\n\n`;
        message += `📅 <b>Tipo de día:</b> ${dayType}\n`;
        message += `🕒 <b>Horario:</b> ${hours.opening} - ${hours.closing}\n`;
        message += `💰 <b>Tarifa actual:</b> $${currentFare} CLP\n`;
        message += `<i>Sin contar las tarifas diferenciadas, revisa /tarifas</i>\n\n`;
        
        if (TimeHelpers.isExpressActive()) {
            message += `🚄 <b>Líneas con Ruta Expresa:</b> ${metroConfig.expressLines.map(l => lineEmojis[l]).join(' ')} ACTIVAS\n\n`;
        }
        
        message += `⏳ <b>Próximo cambio:</b> ${TimeHelpers.getNextTransition().message} a las ${TimeHelpers.getNextTransition().time}\n`;
        
        if (hours.isExtended) {
            message += `\n⚠️ <b>Horario extendido:</b> Servicio hasta ${hours.extension[1]}\n`;
            message += `${metroConfig.stationIcons[5].emoji} ${metroConfig.stationIcons[5].message}`;
        }

        const keyboard = [
            [Markup.button.callback('📅 Ver Horarios Regulares', 'horarios_regular')],
            [Markup.button.callback('💰 Ver Periodos Tarifarios', 'periodos_info')],
            [Markup.button.callback('🔙 Menú Principal', 'horarios_main')]
        ];

        if (ctx.callbackQuery) {
            await safeEditMessage(ctx, message, keyboard);
        } else {
            await ctx.replyWithHTML(message, {
                reply_markup: { inline_keyboard: keyboard }
            });
        }
    } catch (error) {
        handleError(ctx, error, 'mostrar información del período');
    }
}

// Show regular schedule
async function showRegularSchedule(ctx) {
    try {
        // Get schedule information
        const serviceHours = metroConfig.horario;
        const currentHours = TimeHelpers.getOperatingHours();
        
        let message = `<b>⏰ Horarios Regulares del Metro</b> ${getRandomEmoji()}\n\n`;
        message += `🚆 <b>Días Hábiles (L-V):</b> ${serviceHours.Semana[0]} - ${serviceHours.Semana[1]}\n`;
        message += `🟢 <b>Sábados:</b> ${serviceHours.Sábado[0]} - ${serviceHours.Sábado[1]}\n`;
        message += `🔵 <b>Domingos/Feriados:</b> ${serviceHours.Domingo[0]} - ${serviceHours.Domingo[1]}\n\n`;

        if (currentHours.isExtended) {
            const event = TimeHelpers.getEventDetails();
            message += `⚠️ <b>Horario Extendido Hoy</b>\n`;
            message += `Cierre extendido hasta: ${event?.endTime || currentHours.extension[1]}\n`;
            message += `*${event?.name || 'Evento especial'}*\n\n`;
        }

        if (TimeHelpers.isWeekday()) {
            message += `🚄 <b>Horario Expreso (L-V)</b>\n`;
            message += `Mañana: ${metroConfig.horarioExpreso.morning[0]} - ${metroConfig.horarioExpreso.morning[1]}\n`;
            message += `Tarde: ${metroConfig.horarioExpreso.evening[0]} - ${metroConfig.horarioExpreso.evening[1]}\n`;
            message += `Líneas: ${metroConfig.expressLines.map(l => lineEmojis[l]).join(' ')}\n\n`;
        }

        message += `Horarios sujetos a cambios por eventos especiales`;

        const keyboard = [
            [Markup.button.callback('⏰ Ver Período Actual', 'horarios_periodo')],
            [Markup.button.callback('💰 Ver Periodos Tarifarios', 'periodos_info')],
            [Markup.button.callback('🔙 Menú Principal', 'horarios_main')]
        ];

        if (ctx.callbackQuery) {
            await safeEditMessage(ctx, message, keyboard);
        } else {
            await ctx.replyWithHTML(message, {
                reply_markup: { inline_keyboard: keyboard }
            });
        }
    } catch (error) {
        handleError(ctx, error, 'mostrar horarios regulares');
    }
}

// Show fare periods information
async function showPeriodosInfo(ctx) {
    try {
        const currentPeriod = TimeHelpers.getCurrentPeriod();
        const periodos = metroConfig.horarioPeriodos;
        
        const formatTimeRanges = (ranges) => {
            return ranges.map(range => 
                `${range.inicio.split(':')[0]}:${range.inicio.split(':')[1]} - ${range.fin.split(':')[0]}:${range.fin.split(':')[1]}`
            ).join('\n');
        };

        let message = `⏰ <b>Periodos Tarifarios del Metro</b> ${getRandomEmoji()}\n\n`;
        
        message += `🔄 <b>Periodo Actual:</b> ${currentPeriod.name}\n`;
        message += `🕒 ${TimeHelpers.formatTime(new Date())}\n\n`;
        
        message += `🚨 <b>Hora Punta</b>\n`;
        message += `${formatTimeRanges(periodos.PUNTA)}\n\n`;
        
        message += `🟢 <b>Horario Normal</b>\n`;
        message += `${formatTimeRanges(periodos.VALLE)}\n\n`;
        
        message += `🔵 <b>Horario Bajo</b>\n`;
        message += `${formatTimeRanges(periodos.BAJO)}\n\n`;
        
        if (TimeHelpers.isWeekday()) {
            message += `🚄 <b>Rutas Expresas (L-V):</b>\n`;
            message += `Mañana: ${metroConfig.horarioExpreso.morning[0]} - ${metroConfig.horarioExpreso.morning[1]}\n`;
            message += `Tarde: ${metroConfig.horarioExpreso.evening[0]} - ${metroConfig.horarioExpreso.evening[1]}\n`;
            message += `Líneas: ${metroConfig.expressLines.map(l => lineEmojis[l]).join(' ')}\n\n`;
        }

        message += `ℹ️ Los periodos determinan la tarifa aplicable pero no se muestran precios aquí.`;

        const keyboard = [
            [Markup.button.callback('🔄 Actualizar', 'periodos_info')],
            [Markup.button.callback('🔙 Menú Principal', 'horarios_main')]
        ];

        if (ctx.callbackQuery) {
            await safeEditMessage(ctx, message, keyboard);
        } else {
            await ctx.replyWithHTML(message, {
                reply_markup: { inline_keyboard: keyboard }
            });
        }
    } catch (error) {
        handleError(ctx, error, 'mostrar información de periodos');
    }
}

// Error handling function
async function handleError(ctx, error, action = 'procesar el comando') {
    console.error(`[Horarios Error] Error al ${action}:`, error);
    
    let errorMessage = `Error al ${action}: ${error.message}`;
    
    const keyboard = [
        [Markup.button.callback('🔙 Volver', 'horarios_main')]
    ];

    try {
        if (ctx.callbackQuery) {
            await ctx.editMessageText(`❌ ${errorMessage}`, {
                parse_mode: 'HTML',
                reply_markup: { inline_keyboard: keyboard }
            });
        } else {
            await ctx.replyWithHTML(`❌ ${errorMessage}`, {
                reply_markup: { inline_keyboard: keyboard }
            });
        }
    } catch (e) {
        console.error('Error in error handler:', e);
        await ctx.replyWithHTML(`❌ Ocurrió un error inesperado. Por favor intenta nuevamente.`);
    }
}
