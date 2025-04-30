const { handleCreate } = require('./dataManager/create');
const { handleEdit } = require('./dataManager/edit');
const { handleDelete } = require('./dataManager/delete');
const { handleList } = require('./dataManager/list');
const { handleClear } = require('./dataManager/clear');
const { handleUndo } = require('./dataManager/undo');
const { handleRedo } = require('./dataManager/redo');
const { handleReplace } = require('./dataManager/replace');
const { getCache, setCache } = require('../utils/cache');
const { createEmbed } = require('../utils/embeds');
const config = require('../config/config.json');

module.exports = {

    name: 'metrodata',

    description: '🚇 Sistema avanzado de gestión de datos del metro',

    usage: '!metrodata <acción>.<métodos>',

    aliases: ['md'],

    permissions: ['ADMINISTRATOR'], // Only admins can use this command

    async execute(message, args) {

        const isOwner = message.author.id === config.ownerID;

        const isAdmin = message.member.permissions.has('ADMINISTRATOR');

        if (!isOwner && !isAdmin) {

            const embed = createEmbed(

                "🚫 **No tienes permisos.**",

                'error'

            );

            return message.reply({ embeds: [embed] });

        }

        if (args.length === 0 || args[0] === 'help') {

            return showHelp(message);

        }

        await handleDotCommand(message, args.join('.'));

    },

};
async function handleDotCommand(message, command) {

    const userId = message.author.id;

    const embedId = message.id;

    const cacheKey = `${userId}_${embedId}`;

    // Get or initialize user data with proper structure

    let cachedData = getCache(userId, embedId);

    let userData = cachedData ? cachedData.data : {

        lastCommand: null,

        history: [],

        future: [],

        timestamp: Date.now()

    };

    const parts = command.split('.');

    const [action, ...methods] = parts;

    try {

        // Execute command and update history

        switch (action.toLowerCase()) {

            case 'create':

            case 'edit':

            case 'delete':

            case 'clear':

            case 'replace':

                // Save state to history before making changes

                userData.history.push(JSON.stringify(userData));

                userData.future = []; // Clear redo stack

                userData.lastCommand = { action, methods };

                break;

        }

        // Execute the command

        switch (action.toLowerCase()) {

            case 'create':

                await handleCreate(message, methods);

                break;

            case 'edit':

                await handleEdit(message, methods);

                break;

            case 'delete':

                await handleDelete(message, methods);

                break;

            case 'clear':

                await handleClear(message, methods);

                break;

            case 'list':

                await handleList(message, methods);

                break;

            case 'undo':

                await handleUndo(message, userData);

                break;

            case 'redo':

                await handleRedo(message, userData);

                break;

            case 'replace':

                await handleReplace(message, methods);

                break;

            default:

                throw new Error('🚫 Acción no válida. Usa `create`, `edit`, `delete`, `clear`, `list`, `undo`, `redo` o `replace`.');

        }

        // Update cache with new data

        setCache(userId, embedId, {

            data: userData,

            timestamp: Date.now()

        });

    } catch (error) {

        const embed = createEmbed(

            `❌ **Error:** ${error.message}`,

            'error'

        );

        await message.reply({ embeds: [embed] });

    }

}

async function showHelp(message) {

    const embed = createEmbed(

        '**Sistema de puntos con múltiples valores**\nUsa `,` para separar valores y `_` para espacios\n\n**Ejemplos:**',

        'primary',

        '🚇 **Ayuda de MetroData**'

    ).addFields(

        {

            name: '📁 **Crear Directorio/Archivo**',

            value: '```!metrodata create.directory.l1\n!metrodata create.file.l1.pajaritos```',

            inline: false

        },

        {

            name: '✏️ **Editar Datos**',

            value: '```!metrodata edit.file.l1.pajaritos.key.transporte.add.Micro,Bus\n!metrodata edit.file.l1.pajaritos.key.servicios.remove.Cajero```',

            inline: false

        },

        {

            name: '🗑️ **Eliminar**',

            value: '```!metrodata delete.directory.l1\n!metrodata delete.file.l1.pajaritos\n!metrodata delete.key.l1.pajaritos.transporte```',

            inline: false

        },

        {

            name: '🧹 **Limpiar**',

            value: '```!metrodata clear.key.l1.pajaritos.transporte  # Limpia el contenido de la clave transporte```',

            inline: false

        },

        {

            name: '📋 **Listar**',

            value: '```!metrodata list.directories\n!metrodata list.files.l1\n!metrodata list.keys.l1.pajaritos\n!metrodata list.key.l1.pajaritos.transporte\n!metrodata list.key.l1.pajaritos.re  # Repite la última clave```',

            inline: false

        },

        {

            name: '🔄 **Reemplazar**',

            value: '```!metrodata replace.file.l1.pajaritos.key.transporte.Micro,Bus  # Reemplaza el valor de la clave transporte```',

            inline: false

        },

        {

            name: '↩️ **Deshacer/Rehacer**',

            value: '```!metrodata undo\n!metrodata redo```\n**Nota:** Solo funciona para comandos que modifican archivos (`create`, `edit`, `delete`, `clear`, `replace`).',

            inline: false

        },

        {

            name: 'ℹ️ **Sistema de Cache**',

            value: 'Los datos se almacenan temporalmente con el formato:\n`userId_messageId`\nCaduca después de 24 horas de inactividad.',

            inline: false

        }

    );

    await message.reply({ embeds: [embed] });

} 