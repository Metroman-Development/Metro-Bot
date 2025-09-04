const BaseCommand = require('../BaseCommand');
const { getCache, setCache } = require('../../../../utils/cache');
const { createEmbed } = require('../../../../utils/embeds');
const config = require('../../../../config');
const create = require('./dataManager/create');
const edit = require('./dataManager/edit');
const del = require('./dataManager/delete');
const list = require('./dataManager/list');
const clear = require('./dataManager/clear');
const undo = require('./dataManager/undo');
const redo = require('./dataManager/redo');
const replace = require('./dataManager/replace');

class DataManagerCommand extends BaseCommand {
    constructor() {
        super({
            name: 'metrodata',
            description: '🚇 Sistema avanzado de gestión de datos del metro',
            usage: '!metrodata <acción>.<métodos>',
            aliases: ['md'],
            permissions: ['ADMINISTRATOR'],
        });

        this.subcommands = new Map([
            ['create', create.run],
            ['edit', edit.run],
            ['delete', del.run],
            ['list', list.run],
            ['clear', clear.run],
            ['undo', undo.run],
            ['redo', redo.run],
            ['replace', replace.run],
        ]);
    }

    async run(message) {
        const isOwner = message.author.id === config.ownerID;
        const isAdmin = message.member.permissions.has('ADMINISTRATOR');

        if (!isOwner && !isAdmin) {
            const embed = createEmbed("🚫 **No tienes permisos.**", 'error');
            return message.reply({ embeds: [embed] });
        }

        const args = message.content.slice(config.prefix.length).trim().split(/ +/);
        args.shift();

        if (args.length === 0 || args[0] === 'help') {
            return this.showHelp(message);
        }

        const userId = message.author.id;
        const embedId = message.id;
        let cachedData = getCache(userId, embedId);
        let userData = cachedData ? cachedData.data : {
            lastCommand: null,
            history: [],
            future: [],
            timestamp: Date.now()
        };

        const parts = args.join('.').split('.');
        const [action, ...methods] = parts;
        const subcommand = this.subcommands.get(action.toLowerCase());

        if (subcommand) {
            if (['create', 'edit', 'delete', 'clear', 'replace'].includes(action.toLowerCase())) {
                userData.history.push(JSON.stringify(userData));
                userData.future = [];
                userData.lastCommand = { action, methods };
            }
            await subcommand(message, methods, userData);
            setCache(userId, embedId, { data: userData, timestamp: Date.now() });
        } else {
            throw new Error('🚫 Acción no válida. Usa `create`, `edit`, `delete`, `clear`, `list`, `undo`, `redo` o `replace`.');
        }
    }

    async showHelp(message) {
        const embed = createEmbed(
            '**Sistema de puntos con múltiples valores**\nUsa `,` para separar valores y `_` para espacios\n\n**Ejemplos:**',
            'primary',
            '🚇 **Ayuda de MetroData**'
        ).addFields(
            { name: '📁 **Crear Directorio/Archivo**', value: '```!metrodata create.directory.l1\n!metrodata create.file.l1.pajaritos```', inline: false },
            { name: '✏️ **Editar Datos**', value: '```!metrodata edit.file.l1.pajaritos.key.transporte.add.Micro,Bus\n!metrodata edit.file.l1.pajaritos.key.servicios.remove.Cajero```', inline: false },
            { name: '🗑️ **Eliminar**', value: '```!metrodata delete.directory.l1\n!metrodata delete.file.l1.pajaritos\n!metrodata delete.key.l1.pajaritos.transporte```', inline: false },
            { name: '🧹 **Limpiar**', value: '```!metrodata clear.key.l1.pajaritos.transporte  # Limpia el contenido de la clave transporte```', inline: false },
            { name: '📋 **Listar**', value: '```!metrodata list.directories\n!metrodata list.files.l1\n!metrodata list.keys.l1.pajaritos\n!metrodata list.key.l1.pajaritos.transporte\n!metrodata list.key.l1.pajaritos.re  # Repite la última clave```', inline: false },
            { name: '🔄 **Reemplazar**', value: '```!metrodata replace.file.l1.pajaritos.key.transporte.Micro,Bus  # Reemplaza el valor de la clave transporte```', inline: false },
            { name: '↩️ **Deshacer/Rehacer**', value: '```!metrodata undo\n!metrodata redo```\n**Nota:** Solo funciona para comandos que modifican archivos (`create`, `edit`, `delete`, `clear`, `replace`).', inline: false },
            { name: 'ℹ️ **Sistema de Cache**', value: 'Los datos se almacenan temporalmente con el formato:\n`userId_messageId`\nCaduca después de 24 horas de inactividad.', inline: false }
        );
        await message.reply({ embeds: [embed] });
    }
}

module.exports = new DataManagerCommand();