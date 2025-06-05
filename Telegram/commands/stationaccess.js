const { Markup } = require('telegraf');
const MetroCore = require('../../modules/metro/core/MetroCore');
const { formatDate } = require('./estacioninfo');

// MetroCore instance (singleton pattern)
let metroCoreInstance = null;
const SESSION_TIMEOUT = 300000; // 5 minutes timeout

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

            // Initialize session
            ctx.session.stationAccess = {
                active: true,
                currentStation: null,
                currentElementType: null,
                lastActivity: Date.now()
            };

            await showMainMenu(ctx);
        } catch (error) {
            console.error('Error in stationaccess command:', error);
            ctx.reply('❌ Ocurrió un error al procesar el comando.');
        }
    },

    registerActions: (bot) => {
        // Main menu actions
        bot.action('access_main', async (ctx) => {
            await checkAndUpdateSession(ctx);
            await ctx.answerCbQuery();
            await showMainMenu(ctx);
        });

        // List stations action
        bot.action('access_list', async (ctx) => {
            await checkAndUpdateSession(ctx);
            await ctx.answerCbQuery();
            await handleList(ctx);
        });

        // Station selection actions
        bot.action(/access_view:(.+)/, async (ctx) => {
            await checkAndUpdateSession(ctx);
            await ctx.answerCbQuery();
            const stationId = ctx.match[1];
            ctx.session.stationAccess.currentStation = stationId;
            await showStationAccessInfo(ctx, stationId);
        });

        // Element type selection actions
        bot.action(/access_status:(.+):(.+)/, async (ctx) => {
            await checkAndUpdateSession(ctx);
            await ctx.answerCbQuery();
            const [stationId, elementType] = ctx.match.slice(1);
            ctx.session.stationAccess.currentStation = stationId;
            ctx.session.stationAccess.currentElementType = elementType;
            await showStatusUpdateMenu(ctx, stationId, elementType);
        });

        // Individual element update actions
        bot.action(/access_status_update:(.+):(.+):(.+)/, async (ctx) => {
            await checkAndUpdateSession(ctx);
            await ctx.answerCbQuery();
            const [stationId, elementType, elementId] = ctx.match.slice(1);
            await showElementStatusOptions(ctx, stationId, elementType, elementId);
        });

        // Bulk status update actions
        bot.action(/access_status_set:(.+):(.+):(.+):(.+)/, async (ctx) => {
            await checkAndUpdateSession(ctx);
            await ctx.answerCbQuery();
            const [stationId, elementType, scope, newStatus] = ctx.match.slice(1);
            await updateElementStatus(ctx, stationId, elementType, scope, newStatus);
        });

        // Configuration actions
        bot.action(/access_config:(.+)/, async (ctx) => {
            await checkAndUpdateSession(ctx);
            await ctx.answerCbQuery();
            const stationId = ctx.match[1];
            await showStationConfigMenu(ctx, stationId);
        });

        // History actions
        bot.action(/access_history:(.+)/, async (ctx) => {
            await checkAndUpdateSession(ctx);
            await ctx.answerCbQuery();
            const stationId = ctx.match[1];
            await showStationHistory(ctx, stationId);
        });

        // Global history action
        bot.action('access_global_history', async (ctx) => {
            await checkAndUpdateSession(ctx);
            await ctx.answerCbQuery();
            await showGlobalHistory(ctx);
        });

        // Help action
        bot.action('access_help', async (ctx) => {
            await checkAndUpdateSession(ctx);
            await ctx.answerCbQuery();
            await showHelp(ctx);
        });

        // Finish action
        bot.action('access_finish', async (ctx) => {
            await ctx.answerCbQuery();
            ctx.session.stationAccess = null;
            await ctx.editMessageText('✅ Sesión de gestión de accesibilidad finalizada.', {
                reply_markup: { inline_keyboard: [] }
            });
        });
    }
};

async function checkAndUpdateSession(ctx) {
    if (!ctx.session.stationAccess || !ctx.session.stationAccess.active) {
        throw new Error('Session expired or not active');
    }
    
    // Check timeout
    if (Date.now() - ctx.session.stationAccess.lastActivity > SESSION_TIMEOUT) {
        ctx.session.stationAccess = null;
        await ctx.editMessageText('⌛ La sesión ha expirado por inactividad. Usa /stationaccess para comenzar de nuevo.', {
            reply_markup: { inline_keyboard: [] }
        });
        throw new Error('Session expired due to inactivity');
    }
    
    // Update last activity
    ctx.session.stationAccess.lastActivity = Date.now();
}

async function showMainMenu(ctx) {
    const message = `🛗 <b>Menú Principal de Gestión de Accesibilidad</b>\n\nSelecciona una acción:`;
    
    const keyboard = [
        [Markup.button.callback('📋 Listar estaciones', 'access_list')],
        [Markup.button.callback('📜 Historial global', 'access_global_history')],
        [Markup.button.callback('ℹ️ Ayuda', 'access_help')],
        [Markup.button.callback('✅ Finalizar', 'access_finish')]
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

    // Add back button
    keyboard.push([Markup.button.callback('🔙 Menú principal', 'access_main')]);

    await ctx.editMessageText(message, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: keyboard }
    });
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

    await ctx.editMessageText(message, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: keyboard }
    });
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

    // Add status options for all elements
    if (elements.length > 0) {
        keyboard.push([
            Markup.button.callback('🟢 Todos operativos', `access_status_set:${stationId}:${elementType}:all:operativa`),
            Markup.button.callback('🟡 Todos en mantención', `access_status_set:${stationId}:${elementType}:all:en mantención`)
        ]);
        keyboard.push([
            Markup.button.callback('🔴 Todos fuera de servicio', `access_status_set:${stationId}:${elementType}:all:fuera de servicio`),
        ]);
    } else {
        message += 'No hay elementos de este tipo configurados.\n';
    }

    // Add navigation buttons
    keyboard.push([
        Markup.button.callback('🔙 Atrás', `access_view:${stationId}`),
        Markup.button.callback('🏠 Menú principal', 'access_main')
    ]);

    await ctx.editMessageText(message, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: keyboard }
    });
}

async function showElementStatusOptions(ctx, stationId, elementType, elementId) {
    const metro = await getMetroCore();
    const station = metro._staticData.stations[stationId];
    const elements = station.accessDetails?.[`${elementType}s`] || [];
    const element = elements.find(e => e.id === elementId);

    if (!element) {
        await ctx.answerCbQuery('Elemento no encontrado', { show_alert: true });
        return;
    }

    let message = `<b>🔄 Actualizar estado - ${station.displayName}</b>\n\n`;
    message += `<b>Elemento:</b> ${elementId || element.name}\n`;
    message += `<b>Estado actual:</b> ${getStatusEmoji(element.status)} ${element.status}\n\n`;
    message += `Selecciona el nuevo estado:`;

    const keyboard = [
        [
            Markup.button.callback('🟢 Operativo', `access_status_set:${stationId}:${elementType}:${elementId}:operativa`),
            Markup.button.callback('🟡 En mantención', `access_status_set:${stationId}:${elementType}:${elementId}:en mantención`)
        ],
        [
            Markup.button.callback('🔴 Fuera de servicio', `access_status_set:${stationId}:${elementType}:${elementId}:fuera de servicio`),
            Markup.button.callback('⚪ Otro estado', `access_status_set:${stationId}:${elementType}:${elementId}:otro`)
        ],
        [
            Markup.button.callback('🔙 Atrás', `access_status:${stationId}:${elementType}`),
            Markup.button.callback('🏠 Menú principal', 'access_main')
        ]
    ];

    await ctx.editMessageText(message, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: keyboard }
    });
}

async function updateElementStatus(ctx, stationId, elementType, scope, newStatus) {
    const metro = await getMetroCore();
    const station = metro._staticData.stations[stationId];
    
    // Here you would implement the actual status update logic
    // For now, we'll just show a confirmation
    
    let message = `<b>✅ Estado actualizado</b>\n\n`;
    
    if (scope === 'all') {
        message += `Todos los ${elementType}s de ${station.displayName} actualizados a: ${newStatus}`;
    } else {
        message += `${elementType} ${scope} de ${station.displayName} actualizado a: ${newStatus}`;
    }

    const keyboard = [
        [
            Markup.button.callback('🔄 Actualizar otro', `access_status:${stationId}:${elementType}`),
            Markup.button.callback('🏠 Menú principal', 'access_main')
        ]
    ];

    await ctx.editMessageText(message, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: keyboard }
    });
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
            Markup.button.callback('🔙 Volver', `access_view:${stationId}`),
            Markup.button.callback('🏠 Menú principal', 'access_main')
        ]
    ];

    await ctx.editMessageText(message, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: keyboard }
    });
}

async function showGlobalHistory(ctx) {
    const metro = await getMetroCore();
    const stations = Object.values(metro._staticData.stations)
        .filter(s => s.accessDetails?.changelistory?.length);

    let message = `<b>📜 Historial Global de Accesibilidad</b>\n\n`;
    
    // Get all changes, sort by date, and take the last 15
    const allChanges = stations.flatMap(station => 
        station.accessDetails.changelistory.map(change => ({
            ...change,
            stationName: station.displayName
        }))
    ).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 15);

    if (allChanges.length === 0) {
        message += 'No hay registros de cambios recientes.';
    } else {
        allChanges.forEach(change => {
            message += `📅 <b>${formatDate(change.timestamp)}</b>\n`;
            message += `🏷️ <i>${change.stationName}</i>\n`;
            message += `👤 ${change.user}\n`;
            message += `🔄 ${change.action}\n\n`;
        });
    }

    const keyboard = [
        [
            Markup.button.callback('🔙 Volver', 'access_main'),
            Markup.button.callback('🏠 Menú principal', 'access_main')
        ]
    ];

    await ctx.editMessageText(message, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: keyboard }
    });
}

async function showHelp(ctx) {
    const message = `<b>ℹ️ Ayuda - Gestión de Accesibilidad</b>\n\n`
        + `Este módulo permite gestionar el estado de los elementos de accesibilidad en las estaciones.\n\n`
        + `<b>Funcionalidades:</b>\n`
        + `- Ver estado actual de ascensores, escaleras y accesos\n`
        + `- Actualizar estados individuales o en masa\n`
        + `- Consultar historial de cambios\n\n`
        + `La sesión permanecerá activa hasta que selecciones "Finalizar".`;

    const keyboard = [
        [Markup.button.callback('🔙 Volver', 'access_main')]
    ];

    await ctx.editMessageText(message, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: keyboard }
    });
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
