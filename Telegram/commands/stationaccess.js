
const { Markup } = require('telegraf');
const MetroCore = require('../../modules/metro/core/MetroCore');
const { formatDate } = require('./estacioninfo');

// MetroCore instance (singleton pattern)
let metroCoreInstance = null;

async function getMetroCore() {
    if (!metroCoreInstance) {
        metroCoreInstance = await MetroCore.getInstance();
    }
    return metroCoreInstance;
}

module.exports = {
    execute: async (ctx) => {
        try {
            // Check if user is authorized
            if (ctx.from.id !== 6566554074) {
                return ctx.reply('🔒 No tienes permisos para usar este comando.');
            }

            const args = ctx.message.text.split(' ').slice(1);
            const [action, ...restArgs] = args;

            if (!action) {
                return showMainMenu(ctx);
            }

            switch (action.toLowerCase()) {
                case 'config':
                case 'configure':
                    return handleConfigure(ctx, restArgs);
                case 'status':
                case 'estado':
                    return handleStatus(ctx, restArgs);
                case 'view':
                case 'ver':
                    return handleView(ctx, restArgs);
                case 'list':
                case 'listar':
                    return handleList(ctx);
                case 'history':
                case 'historial':
                    return handleHistory(ctx, restArgs);
                default:
                    return showMainMenu(ctx);
            }
        } catch (error) {
            console.error('Error in stationaccess command:', error);
            ctx.reply('❌ Ocurrió un error al procesar el comando.');
        }
    },

    registerActions: (bot) => {
        // Main menu actions
        bot.action('access_main', async (ctx) => {
            await ctx.answerCbQuery();
            await showMainMenu(ctx);
        });

        // Configuration actions
        bot.action(/access_config:(.+)/, async (ctx) => {
            await ctx.answerCbQuery();
            const stationId = ctx.match[1];
            await showStationConfigMenu(ctx, stationId);
        });

        // Status update actions
        bot.action(/access_status:(.+):(.+)/, async (ctx) => {
            await ctx.answerCbQuery();
            const [stationId, elementType] = ctx.match.slice(1);
            await showStatusUpdateMenu(ctx, stationId, elementType);
        });

        // View actions
        bot.action(/access_view:(.+)/, async (ctx) => {
            await ctx.answerCbQuery();
            const stationId = ctx.match[1];
            await showStationAccessInfo(ctx, stationId);
        });

        // History actions
        bot.action(/access_history:(.+)/, async (ctx) => {
            await ctx.answerCbQuery();
            const stationId = ctx.match[1];
            await showStationHistory(ctx, stationId);
        });
    }
};

async function showMainMenu(ctx) {
    const metro = await getMetroCore();
    const stations = Object.values(metro._staticData.stations);

    const message = `🛗 <b>Menú de Gestión de Accesibilidad</b>\n\nSelecciona una acción:`;
    
    const keyboard = [
        [
            Markup.button.callback('📋 Listar estaciones', 'access_list'),
            Markup.button.callback('🔄 Historial global', 'access_global_history')
        ],
        [
            Markup.button.callback('ℹ️ Ayuda', 'access_help')
        ]
    ];

    if (ctx.callbackQuery) {
        await ctx.editMessageText(message, {
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: keyboard }
        });
    } else {
        await ctx.replyWithHTML(message, {
            reply_markup: { inline_keyboard: keyboard }
        });
    }
}

async function handleList(ctx) {
    const metro = await getMetroCore();
    const stations = Object.values(metro._staticData.stations)
        .filter(s => s.accessDetails)
        .sort((a, b) => a.displayName.localeCompare(b.displayName));

    let message = `<b>📋 Estaciones con configuración de accesibilidad</b>\n\n`;
    
    const keyboard = stations.map(station => [
        Markup.button.callback(
            `${station.displayName}`,
            `access_view:${station.id}`
        )
    ]);

    if (ctx.callbackQuery) {
        await ctx.editMessageText(message, {
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: keyboard }
        });
    } else {
        await ctx.replyWithHTML(message, {
            reply_markup: { inline_keyboard: keyboard }
        });
    }
}

async function showStationAccessInfo(ctx, stationId) {
    const metro = await getMetroCore();
    const station = metro._staticData.stations[stationId];
    
    if (!station || !station.accessDetails) {
        return ctx.reply('No se encontró información de accesibilidad para esta estación.');
    }

    let message = `<b>♿ ${station.displayName} - Accesibilidad</b>\n\n`;
    
    // Summary information
    if (station.accessDetails.elevators?.length) {
        const operational = station.accessDetails.elevators.filter(e => e.status === 'operativa').length;
        message += `🛗 <b>Ascensores:</b> ${operational}/${station.accessDetails.elevators.length} operativos\n`;
    }
    
    if (station.accessDetails.escalators?.length) {
        const operational = station.accessDetails.escalators.filter(e => e.status === 'operativa').length;
        message += `🪜 <b>Escaleras:</b> ${operational}/${station.accessDetails.escalators.length} operativas\n`;
    }
    
    if (station.accessDetails.accesses?.length) {
        const open = station.accessDetails.accesses.filter(a => a.status === 'abierto').length;
        message += `🚪 <b>Accesos:</b> ${open}/${station.accessDetails.accesses.length} abiertos\n\n`;
    }

    // Latest change
    if (station.accessDetails.changelistory?.length) {
        const latestChange = station.accessDetails.changelistory
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
        message += `📝 <b>Último cambio:</b>\n`;
        message += `- Acción: ${latestChange.action}\n`;
        message += `- Por: ${latestChange.user}\n`;
        message += `- Fecha: ${formatDate(latestChange.timestamp)}\n\n`;
    }

    const keyboard = [
        [
            Markup.button.callback('🛗 Ascensores', `access_status:${stationId}:elevator`),
            Markup.button.callback('🪜 Escaleras', `access_status:${stationId}:escalator`)
        ],
        [
            Markup.button.callback('🚪 Accesos', `access_status:${stationId}:access`),
            Markup.button.callback('📋 Historial', `access_history:${stationId}`)
        ],
        [
            Markup.button.callback('⚙️ Configurar', `access_config:${stationId}`),
            Markup.button.callback('🔙 Menú principal', 'access_main')
        ]
    ];

    if (ctx.callbackQuery) {
        await ctx.editMessageText(message, {
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: keyboard }
        });
    } else {
        await ctx.replyWithHTML(message, {
            reply_markup: { inline_keyboard: keyboard }
        });
    }
}

async function showStatusUpdateMenu(ctx, stationId, elementType) {
    const metro = await getMetroCore();
    const station = metro._staticData.stations[stationId];
    const elements = station.accessDetails?.[`${elementType}s`] || [];
    
    let message = `<b>🔄 Actualizar estado - ${station.displayName}</b>\n\n`;
    message += `Selecciona el elemento a actualizar:\n\n`;

    const keyboard = elements.map(element => [
        Markup.button.callback(
            `${getStatusEmoji(element.status)} ${element.id || element.name} (${element.status})`,
            `access_status_update:${stationId}:${elementType}:${element.id}`
        )
    ]);

    // Add status options for each element
    if (elements.length > 0) {
        keyboard.push([
            Markup.button.callback('🟢 Operativo', `access_status_set:${stationId}:${elementType}:all:operativa`),
            Markup.button.callback('🟡 Mantención', `access_status_set:${stationId}:${elementType}:all:en mantención`)
        ]);
        keyboard.push([
            Markup.button.callback('🔴 Fuera de servicio', `access_status_set:${stationId}:${elementType}:all:fuera de servicio`),
            Markup.button.callback('🔙 Atrás', `access_view:${stationId}`)
        ]);
    } else {
        keyboard.push([
            Markup.button.callback('🔙 Atrás', `access_view:${stationId}`)
        ]);
        message += 'No hay elementos de este tipo configurados.';
    }

    if (ctx.callbackQuery) {
        await ctx.editMessageText(message, {
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: keyboard }
        });
    } else {
        await ctx.replyWithHTML(message, {
            reply_markup: { inline_keyboard: keyboard }
        });
    }
}

async function showStationHistory(ctx, stationId) {
    const metro = await getMetroCore();
    const station = metro._staticData.stations[stationId];
    
    if (!station || !station.accessDetails?.changelistory?.length) {
        return ctx.reply('No hay historial de cambios para esta estación.');
    }

    const history = station.accessDetails.changelistory
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, 10);

    let message = `<b>📋 Historial de cambios - ${station.displayName}</b>\n\n`;
    
    history.forEach(change => {
        message += `📅 <b>${formatDate(change.timestamp)}</b>\n`;
        message += `👤 <i>${change.user}</i>\n`;
        message += `🔄 ${change.action}\n\n`;
    });

    const keyboard = [
        [
            Markup.button.callback('🔙 Volver', `access_view:${stationId}`)
        ]
    ];

    if (ctx.callbackQuery) {
        await ctx.editMessageText(message, {
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: keyboard }
        });
    } else {
        await ctx.replyWithHTML(message, {
            reply_markup: { inline_keyboard: keyboard }
        });
    }
}

function getStatusEmoji(status) {
    const statusMap = {
        'operativa': '🟢',
        'abierto': '🟢',
        'fuera de servicio': '🔴',
        'cerrado': '🔴',
        'en mantención': '🟡',
        'restringido': '🟡',
        'normal': '🟢',
        'alterado': '🟡',
        'suspendido': '🔴'
    };
    return statusMap[status?.toLowerCase()] || '⚪';
}
