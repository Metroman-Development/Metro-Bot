const { Markup, session } = require('telegraf');
const MetroCore = require('../../modules/metro/core/MetroCore');
const path = require('path');
const fs = require('fs').promises;

// Configuration
const ADMIN_USER_ID = 6566554074; // Your admin user ID
const OVERRIDES_FILE = path.join(__dirname, '../../modules/metro/data/json/statusOverrides.json');

// Status override types
const OVERRIDE_TYPES = {
    'line': {
        emoji: '🟢',
        name: 'Línea',
        fields: ['enabled', 'estado', 'mensaje', 'mensaje_app']
    },
    'station': {
        emoji: '🚉',
        name: 'Estación',
        fields: ['enabled', 'estado', 'descripcion', 'descripcion_app']
    }
};

// Session management setup
function setupSession(bot) {
   /* bot.use(session({
        defaultSession: () => ({
            editingContext: null
        })
    }));*/
    return 
}

function getSession(ctx) {
    if (!ctx.session) {
        ctx.session = {};
    }
    if (!ctx.session.editingContext) {
        ctx.session.editingContext = null;
    }
    return ctx.session;
}

function clearSession(ctx) {
    ctx.session.editingContext = null;
}

// Helper functions
async function loadOverrides() {
    try {
        const data = await fs.readFile(OVERRIDES_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            return { lines: {}, stations: {} };
        }
        throw error;
    }
}

async function saveOverrides(overrides) {
    await fs.writeFile(OVERRIDES_FILE, JSON.stringify(overrides, null, 2), 'utf8');
}

async function checkAccessPermissions(userId) {
    return userId === ADMIN_USER_ID;
}

async function handleError(ctx, error, action = 'procesar el comando') {
    console.error(`[StatusOverride Error] Error al ${action}:`, error);
    
    let errorMessage;
    if (error.message.includes('not available')) {
        errorMessage = 'Funcionalidad no disponible temporalmente';
    } else if (error.message.includes('not found')) {
        errorMessage = 'Recurso no encontrado';
    } else if (error.message.includes('permission')) {
        errorMessage = 'No tienes permisos para esta acción';
    } else {
        errorMessage = `Error al ${action}: ${error.message}`;
    }
    
    const keyboard = [
        [Markup.button.callback('🔙 Volver', 'override_main')]
    ];

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
}

// Main menu
async function showMainMenu(ctx) {
    const message = `⚙️ <b>Menú de Gestión de Overrides</b>\n\nSelecciona una acción:`;
    
    const keyboard = [
        [Markup.button.callback('🚇 Gestionar líneas', 'override_list_lines')],
        [Markup.button.callback('🚉 Gestionar estaciones', 'override_list_stations')],
        [Markup.button.callback('➕ Añadir override', 'override_add_menu')],
        [Markup.button.callback('➖ Eliminar override', 'override_remove_menu')],
        [Markup.button.callback('ℹ️ Ayuda', 'override_help')],
        [Markup.button.callback('✅ Finalizar', 'override_finish')]
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

// Add override menu
async function showAddMenu(ctx) {
    const message = `➕ <b>Añadir nuevo override</b>\n\nSelecciona el tipo:`;
    
    const keyboard = [
        [Markup.button.callback('🚇 Añadir línea', 'override_add_line')],
        [Markup.button.callback('🚉 Añadir estación', 'override_add_station')],
        [Markup.button.callback('🔙 Menú principal', 'override_main')]
    ];

    await ctx.editMessageText(message, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: keyboard }
    });
}

// Remove override menu
async function showRemoveMenu(ctx) {
    const overrides = await loadOverrides();
    
    let message = `➖ <b>Eliminar override</b>\n\nSelecciona el override a eliminar:`;
    
    const keyboard = [];

    // Add line overrides to remove
    if (Object.keys(overrides.lines).length > 0) {
        keyboard.push([Markup.button.callback('🚇 Líneas con override', 'override_remove_line_list')]);
    }

    // Add station overrides to remove
    if (Object.keys(overrides.stations).length > 0) {
        keyboard.push([Markup.button.callback('🚉 Estaciones con override', 'override_remove_station_list')]);
    }

    if (keyboard.length === 0) {
        message += '\n\nNo hay overrides configurados para eliminar.';
    }

    keyboard.push([Markup.button.callback('🔙 Menú principal', 'override_main')]);

    await ctx.editMessageText(message, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: keyboard }
    });
}

// List lines
async function listLines(ctx) {
    try {
        const metro = await MetroCore.getInstance();
        const overrides = await loadOverrides();
        
        let message = `<b>🚇 Líneas con Overrides</b>\n\n`;
        
        const keyboard = Object.entries(metro._staticData.lines).map(([lineId, line]) => {
            const override = overrides.lines[lineId] || {};
            const status = override.enabled ? '🟢 Activado' : '🔴 Desactivado';
            return [Markup.button.callback(
                `${line.name} - ${status}`,
                `override_view:line:${lineId}`
            )];
        });

        keyboard.push([Markup.button.callback('🔙 Menú principal', 'override_main')]);

        await ctx.editMessageText(message, {
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: keyboard }
        });
    } catch (error) {
        handleError(ctx, error, 'listar líneas');
    }
}

// List stations with pagination
async function listStations(ctx, page = 0) {
    try {
        const metro = await MetroCore.getInstance();
        const overrides = await loadOverrides();
        
        const stations = Object.values(metro._staticData.stations)
            .sort((a, b) => a.displayName.localeCompare(b.displayName));
        
        const itemsPerPage = 10;
        const totalPages = Math.ceil(stations.length / itemsPerPage);
        const startIdx = page * itemsPerPage;
        const endIdx = startIdx + itemsPerPage;
        const paginatedStations = stations.slice(startIdx, endIdx);
        
        let message = `<b>🚉 Estaciones con Overrides</b>\n\n`;
        message += `Página ${page + 1} de ${totalPages}\n\n`;
        
        const keyboard = paginatedStations.map(station => {
            const override = overrides.stations[station.code] || {};
            const status = override.enabled ? '🟢 Activado' : '🔴 Desactivado';
            return [Markup.button.callback(
                `${station.displayName} - ${status}`,
                `override_view:station:${station.code}`
            )];
        });

        // Add pagination controls if needed
        if (totalPages > 1) {
            const paginationRow = [];
            if (page > 0) {
                paginationRow.push(Markup.button.callback('⬅️ Anterior', `override_list_stations:${page - 1}`));
            }
            if (page < totalPages - 1) {
                paginationRow.push(Markup.button.callback('➡️ Siguiente', `override_list_stations:${page + 1}`));
            }
            keyboard.push(paginationRow);
        }

        keyboard.push([Markup.button.callback('🔙 Menú principal', 'override_main')]);

        await ctx.editMessageText(message, {
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: keyboard }
        });
    } catch (error) {
        handleError(ctx, error, 'listar estaciones');
    }
}

// List lines for removal
async function listLinesForRemoval(ctx) {
    try {
        const metro = await MetroCore.getInstance();
        const overrides = await loadOverrides();
        
        let message = `<b>🚇 Líneas con Overrides</b>\n\nSelecciona una línea para eliminar su override:`;
        
        const keyboard = Object.entries(metro._staticData.lines)
            .filter(([lineId]) => overrides.lines[lineId])
            .map(([lineId, line]) => {
                return [Markup.button.callback(
                    `${line.name}`,
                    `override_remove_confirm:line:${lineId}`
                )];
            });

        keyboard.push([Markup.button.callback('🔙 Atrás', 'override_remove_menu')]);

        await ctx.editMessageText(message, {
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: keyboard }
        });
    } catch (error) {
        handleError(ctx, error, 'listar líneas para eliminación');
    }
}

// List stations for removal with pagination
async function listStationsForRemoval(ctx, page = 0) {
    try {
        const metro = await MetroCore.getInstance();
        const overrides = await loadOverrides();
        
        const stations = Object.values(metro._staticData.stations)
            .filter(station => overrides.stations[station.code])
            .sort((a, b) => a.displayName.localeCompare(b.displayName));
        
        const itemsPerPage = 10;
        const totalPages = Math.ceil(stations.length / itemsPerPage);
        const startIdx = page * itemsPerPage;
        const endIdx = startIdx + itemsPerPage;
        const paginatedStations = stations.slice(startIdx, endIdx);
        
        let message = `<b>🚉 Estaciones con Overrides</b>\n\n`;
        message += `Selecciona una estación para eliminar su override:\n`;
        message += `Página ${page + 1} de ${totalPages}\n\n`;
        
        const keyboard = paginatedStations.map(station => {
            return [Markup.button.callback(
                `${station.displayName}`,
                `override_remove_confirm:station:${station.code}`
            )];
        });

        // Add pagination controls if needed
        if (totalPages > 1) {
            const paginationRow = [];
            if (page > 0) {
                paginationRow.push(Markup.button.callback('⬅️ Anterior', `override_remove_station_list:${page - 1}`));
            }
            if (page < totalPages - 1) {
                paginationRow.push(Markup.button.callback('➡️ Siguiente', `override_remove_station_list:${page + 1}`));
            }
            keyboard.push(paginationRow);
        }

        keyboard.push([Markup.button.callback('🔙 Atrás', 'override_remove_menu')]);

        await ctx.editMessageText(message, {
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: keyboard }
        });
    } catch (error) {
        handleError(ctx, error, 'listar estaciones para eliminación');
    }
}

// Add line override
async function addLineOverride(ctx) {
    try {
        const metro = await MetroCore.getInstance();
        const overrides = await loadOverrides();
        
        let message = `<b>🚇 Añadir override de línea</b>\n\nSelecciona una línea:`;
        
        const keyboard = Object.entries(metro._staticData.lines)
            .filter(([lineId]) => !overrides.lines[lineId])
            .map(([lineId, line]) => {
                return [Markup.button.callback(
                    `${line.name}`,
                    `override_add_confirm:line:${lineId}`
                )];
            });

        if (keyboard.length === 0) {
            message += '\n\nTodas las líneas ya tienen override configurado.';
        }

        keyboard.push([Markup.button.callback('🔙 Atrás', 'override_add_menu')]);

        await ctx.editMessageText(message, {
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: keyboard }
        });
    } catch (error) {
        handleError(ctx, error, 'añadir override de línea');
    }
}

// Add station override
async function addStationOverride(ctx) {
    try {
        const metro = await MetroCore.getInstance();
        const overrides = await loadOverrides();
        
        let message = `<b>🚉 Añadir override de estación</b>\n\nSelecciona una estación:`;
        
        const keyboard = Object.values(metro._staticData.stations)
            .filter(station => !overrides.stations[station.code])
            .sort((a, b) => a.displayName.localeCompare(b.displayName))
            .map(station => {
                return [Markup.button.callback(
                    `${station.displayName}`,
                    `override_add_confirm:station:${station.code}`
                )];
            });

        if (keyboard.length === 0) {
            message += '\n\nTodas las estaciones ya tienen override configurado.';
        }

        keyboard.push([Markup.button.callback('🔙 Atrás', 'override_add_menu')]);

        await ctx.editMessageText(message, {
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: keyboard }
        });
    } catch (error) {
        handleError(ctx, error, 'añadir override de estación');
    }
}

// View override details
async function viewOverride(ctx, type, id) {
    try {
        const metro = await MetroCore.getInstance();
        const overrides = await loadOverrides();
        
        let item, override;
        if (type === 'line') {
            item = metro._staticData.lines[id];
            override = overrides.lines[id] || {};
        } else {
            item = Object.values(metro._staticData.stations).find(s => s.code === id);
            override = overrides.stations[id] || {};
        }

        if (!item) {
            throw new Error(`${type === 'line' ? 'Línea' : 'Estación'} no encontrada`);
        }

        const config = OVERRIDE_TYPES[type];
        const displayName = item.displayName || item.name;
        
        let message = `<b>${config.emoji} ${displayName}</b>\n\n`;
        message += `<b>Estado:</b> ${override.enabled ? '🟢 Activado' : '🔴 Desactivado'}\n`;
        
        if (type === 'line') {
            message += `<b>Estado del servicio:</b> ${override.estado || 'No definido'}\n`;
            message += `<b>Mensaje:</b> ${override.mensaje || 'Ninguno'}\n`;
            message += `<b>Mensaje App:</b> ${override.mensaje_app || 'Ninguno'}\n`;
        } else {
            message += `<b>Estado de la estación:</b> ${override.estado || 'No definido'}\n`;
            message += `<b>Descripción:</b> ${override.descripcion || 'Ninguna'}\n`;
            message += `<b>Descripción App:</b> ${override.descripcion_app || 'Ninguna'}\n`;
        }
        
        message += `\nSelecciona una acción:`;

        const keyboard = [
            [
                Markup.button.callback(
                    override.enabled ? '🔴 Desactivar' : '🟢 Activar',
                    `override_toggle:${type}:${id}`
                )
            ],
            [
                Markup.button.callback('✏️ Editar estado', `override_edit:${type}:${id}:estado`),
                Markup.button.callback('📝 Editar mensaje', `override_edit:${type}:${id}:${type === 'line' ? 'mensaje' : 'descripcion'}`)
            ],
            [
                Markup.button.callback('📱 Editar mensaje app', `override_edit:${type}:${id}:${type === 'line' ? 'mensaje_app' : 'descripcion_app'}`)
            ],
            [
                Markup.button.callback('🔙 Volver', type === 'line' ? 'override_list_lines' : 'override_list_stations'),
                Markup.button.callback('🏠 Menú principal', 'override_main')
            ]
        ];

        await ctx.editMessageText(message, {
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: keyboard }
        });
    } catch (error) {
        handleError(ctx, error, 'ver detalles de override');
    }
}

// Confirm add override
async function confirmAddOverride(ctx, type, id) {
    try {
        const metro = await MetroCore.getInstance();
        const overrides = await loadOverrides();
        const target = type === 'line' ? overrides.lines : overrides.stations;
        
        if (target[id]) {
            throw new Error(`${type === 'line' ? 'Línea' : 'Estación'} ya tiene override configurado`);
        }

        // Initialize new override with default values
        target[id] = {
            enabled: true,
            estado: "1",
            lastUpdated: new Date().toISOString(),
            updatedBy: "admin"
        };

        if (type === 'line') {
            target[id].mensaje = "";
            target[id].mensaje_app = "";
        } else {
            target[id].descripcion = "";
            target[id].descripcion_app = "";
        }

        await saveOverrides(overrides);

        let message = `<b>✅ Override añadido</b>\n\n`;
        message += `Se ha añadido un override para ${type === 'line' ? 'la línea' : 'la estación'}: `;
        message += type === 'line' ? metro._staticData.lines[id].name : 
            Object.values(metro._staticData.stations).find(s => s.code === id).displayName;

        const keyboard = [
            [Markup.button.callback('⚙️ Configurar', `override_view:${type}:${id}`)],
            [Markup.button.callback('➕ Añadir otro', 'override_add_menu')],
            [Markup.button.callback('🏠 Menú principal', 'override_main')]
        ];

        await ctx.editMessageText(message, {
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: keyboard }
        });
    } catch (error) {
        handleError(ctx, error, 'confirmar añadir override');
    }
}

// Confirm remove override
async function confirmRemoveOverride(ctx, type, id) {
    try {
        const metro = await MetroCore.getInstance();
        const overrides = await loadOverrides();
        const target = type === 'line' ? overrides.lines : overrides.stations;
        
        if (!target[id]) {
            throw new Error(`${type === 'line' ? 'Línea' : 'Estación'} no tiene override configurado`);
        }

        const name = type === 'line' ? metro._staticData.lines[id].name : 
            Object.values(metro._staticData.stations).find(s => s.code === id).displayName;

        delete target[id];
        await saveOverrides(overrides);

        let message = `<b>✅ Override eliminado</b>\n\n`;
        message += `Se ha eliminado el override para ${type === 'line' ? 'la línea' : 'la estación'}: ${name}`;

        const keyboard = [
            [Markup.button.callback('➖ Eliminar otro', 'override_remove_menu')],
            [Markup.button.callback('🏠 Menú principal', 'override_main')]
        ];

        await ctx.editMessageText(message, {
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: keyboard }
        });
    } catch (error) {
        handleError(ctx, error, 'confirmar eliminar override');
    }
}

// Toggle override
async function toggleOverride(ctx, type, id) {
    try {
        const overrides = await loadOverrides();
        const target = type === 'line' ? overrides.lines : overrides.stations;
        
        if (!target[id]) {
            target[id] = { enabled: false };
        }
        
        target[id].enabled = !target[id].enabled;
        target[id].lastUpdated = new Date().toISOString();
        target[id].updatedBy = "admin";
        
        await saveOverrides(overrides);
        await viewOverride(ctx, type, id);
    } catch (error) {
        handleError(ctx, error, 'alternar override');
    }
}

// Edit override field
async function editOverrideField(ctx, type, id, field) {
    try {
        const session = getSession(ctx);
        session.editingContext = {
            action: 'edit_override',
            type,
            id,
            field
        };

        const fieldNames = {
            'estado': 'estado',
            'mensaje': 'mensaje',
            'mensaje_app': 'mensaje para la app',
            'descripcion': 'descripción',
            'descripcion_app': 'descripción para la app'
        };

        const message = `<b>✏️ Editar ${fieldNames[field] || field}</b>\n\nPor favor, envía el nuevo valor para ${fieldNames[field] || field}:`;

        const keyboard = [
            [Markup.button.callback('❌ Cancelar', `override_view:${type}:${id}`)]
        ];

        await ctx.editMessageText(message, {
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: keyboard }
        });
    } catch (error) {
        handleError(ctx, error, 'editar campo');
    }
}

// Handle edit input
async function handleEditInput(ctx, text) {
    try {
        const session = getSession(ctx);
        if (!session.editingContext || session.editingContext.action !== 'edit_override') {
            return;
        }

        const { type, id, field } = session.editingContext;
        const overrides = await loadOverrides();
        const target = type === 'line' ? overrides.lines : overrides.stations;
        
        if (!target[id]) {
            target[id] = {};
        }
        
        target[id][field] = text;
        target[id].lastUpdated = new Date().toISOString();
        target[id].updatedBy = "admin";
        
        await saveOverrides(overrides);
        clearSession(ctx);
        
        await viewOverride(ctx, type, id);
    } catch (error) {
        handleError(ctx, error, 'procesar edición');
    }
}

// Help menu
async function showHelp(ctx) {
    const message = `<b>ℹ️ Ayuda - Gestión de Overrides</b>\n\n`
        + `Este módulo permite gestionar los overrides de estado para líneas y estaciones.\n\n`
        + `<b>Funcionalidades:</b>\n`
        + `- Activar/desactivar líneas y estaciones\n`
        + `- Configurar mensajes personalizados\n`
        + `- Añadir/eliminar overrides\n\n`
        + `<b>Uso:</b>\n`
        + `Usa los botones para navegar por las opciones.`;

    const keyboard = [
        [Markup.button.callback('🔙 Volver', 'override_main')]
    ];

    await ctx.editMessageText(message, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: keyboard }
    });
}

// Handle messages


// Handle messages - Updated version
async function handleMessage(ctx) {
    try {
        const session = getSession(ctx);
        if (!session.editingContext || session.editingContext.action !== 'edit_override') {
            return; // Not in edit mode
        }

        const text = ctx.message.text.trim();
        
        // Input validation
        if (text.length > 500) {
            await ctx.reply('El mensaje es demasiado largo (máximo 500 caracteres)');
            return;
        }

        console.log(`Processing edit input for ${session.editingContext.field}: ${text}`);
        await handleEditInput(ctx, text);
        
        // Delete the user's message to keep chat clean
        try {
            await ctx.deleteMessage();
        } catch (e) {
            console.error('Could not delete message:', e);
        }
        
        // Answer the message to prevent "bot is typing" indicator from staying
        await ctx.answerCbQuery();
    } catch (error) {
        handleError(ctx, error, 'procesar mensaje');
    }
}

// Register actions
function registerActions(bot) {
    setupSession(bot);

    // Main menu
    bot.action('override_main', async (ctx) => {
        await ctx.answerCbQuery();
        await showMainMenu(ctx);
    });

    // List lines
    bot.action('override_list_lines', async (ctx) => {
        await ctx.answerCbQuery();
        await listLines(ctx);
    });

    // List stations
    bot.action(/override_list_stations(?::(\d+))?/, async (ctx) => {
        await ctx.answerCbQuery();
        const page = ctx.match[1] ? parseInt(ctx.match[1]) : 0;
        await listStations(ctx, page);
    });

    // Add menu
    bot.action('override_add_menu', async (ctx) => {
        await ctx.answerCbQuery();
        await showAddMenu(ctx);
    });

    // Add line
    bot.action('override_add_line', async (ctx) => {
        await ctx.answerCbQuery();
        await addLineOverride(ctx);
    });

    // Add station
    bot.action('override_add_station', async (ctx) => {
        await ctx.answerCbQuery();
        await addStationOverride(ctx);
    });

    // Confirm add
    bot.action(/override_add_confirm:(.+):(.+)/, async (ctx) => {
        await ctx.answerCbQuery();
        const [type, id] = ctx.match.slice(1);
        await confirmAddOverride(ctx, type, id);
    });

    // Remove menu
    bot.action('override_remove_menu', async (ctx) => {
        await ctx.answerCbQuery();
        await showRemoveMenu(ctx);
    });

    // Remove line list
    bot.action('override_remove_line_list', async (ctx) => {
        await ctx.answerCbQuery();
        await listLinesForRemoval(ctx);
    });

    // Remove station list
    bot.action(/override_remove_station_list(?::(\d+))?/, async (ctx) => {
        await ctx.answerCbQuery();
        const page = ctx.match[1] ? parseInt(ctx.match[1]) : 0;
        await listStationsForRemoval(ctx, page);
    });

    // Confirm remove
    bot.action(/override_remove_confirm:(.+):(.+)/, async (ctx) => {
        await ctx.answerCbQuery();
        const [type, id] = ctx.match.slice(1);
        await confirmRemoveOverride(ctx, type, id);
    });

    // View override
    bot.action(/override_view:(.+):(.+)/, async (ctx) => {
        await ctx.answerCbQuery();
        const [type, id] = ctx.match.slice(1);
        await viewOverride(ctx, type, id);
    });

    // Toggle override
    bot.action(/override_toggle:(.+):(.+)/, async (ctx) => {
        await ctx.answerCbQuery();
        const [type, id] = ctx.match.slice(1);
        await toggleOverride(ctx, type, id);
    });

    // Edit field
    bot.action(/override_edit:(.+):(.+):(.+)/, async (ctx) => {
        await ctx.answerCbQuery();
        const [type, id, field] = ctx.match.slice(1);
        await editOverrideField(ctx, type, id, field);
    });

    // Finish
    bot.action('override_finish', async (ctx) => {
        await ctx.answerCbQuery();
        await ctx.editMessageText('✅ Comando de overrides completado.', {
            reply_markup: { inline_keyboard: [] }
        });
    });

    // Help
    bot.action('override_help', async (ctx) => {
        await ctx.answerCbQuery();
        await showHelp(ctx);
    });


    

    // Add text message handler for edit operations
    bot.on('text', async (ctx) => {
        await handleMessage(ctx);
    });

    // Add timeout cleanup middleware
    bot.use(async (ctx, next) => {
        if (ctx.session?.editingContext) {
            const now = Date.now();
            const lastActivity = ctx.session.editingContext.lastActivity || now;
            
            // Clear session if no activity for 5 minutes
            if (now - lastActivity > 300000) {
                clearSession(ctx);
                if (ctx.chat?.type === 'private') {
                    await ctx.reply('La operación de edición ha expirado por inactividad.');
                }
                return;
            }
            
            // Update last activity time
            ctx.session.editingContext.lastActivity = now;
        }
        await next();
    });



}

module.exports = {
    execute: async (ctx) => {
        try {
            if (!await checkAccessPermissions(ctx.from.id)) {
                return ctx.reply('🔒 No tienes permisos para usar este comando.');
            }
            await showMainMenu(ctx);
        } catch (error) {
            handleError(ctx, error);
        }
    },
    registerActions,
    handleMessage
};
