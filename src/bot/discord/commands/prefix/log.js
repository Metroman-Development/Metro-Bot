const { createEmbed } = require('../../../../utils/embeds');
const { reportBug, resolveBug, getBugById } = require('../../../../utils/bugTracker');
const DatabaseManager = require('../../../../core/database/DatabaseManager');
const TimeHelpers = require('../../../../core/chronos/timeHelpers');
const config = require('../../../../config/config.json');
const cache = require('../../../../core/cache/CacheManager');

// Cache configuration
const LOG_CACHE_NAMESPACE = 'bot:logs';
const BUG_CACHE_NAMESPACE = 'bot:bugs';
const CACHE_TTL = 3600000; // 1 hour in ms

module.exports = {
    name: 'log',
    description: 'Registra cambios, actualizaciones, reportes de errores y más en el canal de logs oficial.',
    usage: '!log <tipo> <componente> <mensaje>',
    permissions: ['ADMINISTRATOR'],
    subcommands: {
        patch: {
            description: 'Registra un arreglo (patch). Incrementa la versión en +0.0.1.',
            usage: '!log patch <componente> <mensaje>'
        },
        feature: {
            description: 'Registra un paquete de características (feature pack). Incrementa la versión en +0.1.0.',
            usage: '!log feature <componente> <mensaje>'
        },
        major: {
            description: 'Registra una actualización mayor (major update). Incrementa la versión en +1.0.0.',
            usage: '!log major <componente> <mensaje>'
        },
        info: {
            description: 'Registra información.',
            usage: '!log info <componente> <mensaje>'
        },
        error: {
            description: 'Registra un error (bug).',
            usage: '!log error <componente> <mensaje>'
        },
        advertencia: {
            description: 'Registra una advertencia (warning).',
            usage: '!log advertencia <componente> <mensaje>'
        },
        mantenimiento: {
            description: 'Registra un mantenimiento (maintenance).',
            usage: '!log mantenimiento <componente> <mensaje>'
        },
        edit: {
            description: 'Edita un log existente según su ID.',
            usage: '!log edit <id> <nuevo_mensaje> o !log edit <id> .title <nuevo_titulo>'
        },
        bug: {
            description: 'Consulta o gestiona un error específico.',
            usage: '!log bug <id> [resolver]',
            subcommands: {
                resolve: {
                    description: 'Marca un error como resuelto.',
                    usage: '!log bug <id> resolve'
                }
            }
        }
    },
    async execute(message, args) {
        if (!message.member.permissions.has('ADMINISTRATOR') && message.author.id !== config.ownerID) {
            return message.reply('🚫 No tienes permisos para usar este comando.');
        }

        if (args.length < 1) {
            return message.reply('❌ Uso correcto: `!log <tipo> <componente> <mensaje>`');
        }

        const [tipo, ...subArgs] = args;

        if (tipo.toLowerCase() === 'bug') {
            return this.handleBugCommand(message, subArgs);
        }

        if (tipo.toLowerCase() === 'edit') {
            return this.handleEditLog(message, subArgs);
        }

        const [componente, ...partesMensaje] = subArgs;
        const mensajeLog = partesMensaje.join(' ');

        const tiposValidos = ['patch', 'feature', 'major', 'info', 'error', 'advertencia', 'mantenimiento'];
        if (!tiposValidos.includes(tipo.toLowerCase())) {
            return message.reply(`❌ Tipo de log no válido. Usa uno de: \`${tiposValidos.join(', ')}\`.`);
        }

        const canalLogs = message.guild.channels.cache.get(config.logChannelID);
        if (!canalLogs) {
            return message.reply('❌ No se pudo encontrar el canal de logs.');
        }

        const titulosLogs = {
            patch: `🛠️ Arreglo: ${componente}`,
            feature: `✨ Actualización: ${componente}`,
            major: `🚀 Actualización Mayor: ${componente}`,
            info: `ℹ️ Información: ${componente}`,
            error: `🐛 Error: ${componente}`,
            advertencia: `⚠️ Advertencia: ${componente}`,
            mantenimiento: `🔧 Mantenimiento: ${componente}`
        };

        const tiposEmbed = {
            patch: 'success',
            feature: 'primary',
            major: 'info',
            info: 'info',
            error: 'error',
            advertencia: 'warning',
            mantenimiento: 'info'
        };

        const embedLog = createEmbed(
            mensajeLog,
            tiposEmbed[tipo.toLowerCase()] || 'primary',
            titulosLogs[tipo.toLowerCase()] || `📝 Log de ${tipo.toUpperCase()}`
        )
        .addFields(
            { name: 'Componente', value: componente, inline: true },
            { name: 'Fecha y Hora (Chile)', value: `${TimeHelpers.currentDay}, ${TimeHelpers.formatForEmbed()}`, inline: true }
        );

        try {
            const db = await DatabaseManager.getInstance();

            let lastVersion;
            try {
                lastVersion = await cache.get(LOG_CACHE_NAMESPACE, 'last_version');
            } catch (cacheError) {
                console.error('Cache get error, falling back to DB:', cacheError.message);
                lastVersion = null;
            }

            if (!lastVersion) {
                const [rows] = await db.query('SELECT version FROM bot_versions ORDER BY created_at DESC LIMIT 1');
                lastVersion = rows.length > 0 ? rows[0].version : '5.0.0';
                try {
                    await cache.set(LOG_CACHE_NAMESPACE, 'last_version', lastVersion, CACHE_TTL);
                } catch (cacheError) {
                    console.error('Cache set error:', cacheError.message);
                }
            }

            if (['patch', 'feature', 'major'].includes(tipo.toLowerCase())) {
                let newVersion;
                const [major, minor, patch] = lastVersion.split('.').map(Number);

                switch (tipo.toLowerCase()) {
                    case 'patch':
                        newVersion = `${major}.${minor}.${patch + 1}`;
                        break;
                    case 'feature':
                        newVersion = `${major}.${minor + 1}.0`;
                        break;
                    case 'major':
                        newVersion = `${major + 1}.0.0`;
                        break;
                }

                await db.query(
                    'INSERT INTO bot_versions (version, release_date, changelog) VALUES (?, CURDATE(), ?)',
                    [newVersion, mensajeLog]
                );

                try {
                    await cache.set(LOG_CACHE_NAMESPACE, 'last_version', newVersion, CACHE_TTL);
                } catch (cacheError) {
                    console.error('Cache set error:', cacheError.message);
                }

                embedLog.addFields({ name: 'Versión', value: newVersion, inline: true });
            }

            if (tipo.toLowerCase() === 'error') {
                const bugId = await reportBug(componente, mensajeLog, message.author.tag);
                embedLog.addFields({ name: 'ID del Error', value: bugId, inline: true });

                try {
                    const bugData = {
                        id: bugId,
                        title: componente,
                        description: mensajeLog,
                        reportedBy: message.author.tag,
                        resolved: false
                    };
                    await cache.set(BUG_CACHE_NAMESPACE, bugId, bugData, CACHE_TTL);
                } catch (cacheError) {
                    console.error('Bug cache set error:', cacheError.message);
                }
            }

            await canalLogs.send({ embeds: [embedLog] });
            message.reply(`✅ Log enviado correctamente al canal <#${config.logChannelID}>.`);
        } catch (error) {
            console.error('Error enviando el log:', error);
            message.reply('❌ Ocurrió un error al enviar el log.');
        }
    },

    async handleEditLog(message, args) {
        if (args.length < 2) {
            return message.reply('❌ Uso correcto: `!log edit <id> <nuevo_mensaje>` o `!log edit <id> .title <nuevo_titulo>`');
        }

        const [logId, ...editArgs] = args;

        try {
            const db = await DatabaseManager.getInstance();
            
            let log;
            try {
                log = await cache.get(LOG_CACHE_NAMESPACE, `log_${logId}`);
            } catch (cacheError) {
                console.error('Cache get error:', cacheError.message);
                log = null;
            }
            
            if (!log) {
                const [logRows] = await db.query('SELECT * FROM bot_versions WHERE id = ?', [logId]);
                if (logRows.length === 0) {
                    return message.reply('❌ No se encontró un log con ese ID.');
                }
                log = logRows[0];
                try {
                    await cache.set(LOG_CACHE_NAMESPACE, `log_${logId}`, log, CACHE_TTL);
                } catch (cacheError) {
                    console.error('Cache set error:', cacheError.message);
                }
            }

            if (editArgs[0] === '.title') {
                const nuevoTitulo = editArgs.slice(1).join(' ');
                await db.query('UPDATE bot_versions SET changelog = ? WHERE id = ?', [nuevoTitulo, logId]);
                
                try {
                    await cache.del(LOG_CACHE_NAMESPACE, `log_${logId}`);
                } catch (cacheError) {
                    console.error('Cache delete error:', cacheError.message);
                }

                const embedLog = createEmbed(
                    log.changelog,
                    'info',
                    `📝 Log Actualizado (ID: ${logId})`
                )
                .addFields(
                    { name: 'Nuevo Título', value: nuevoTitulo, inline: true },
                    { name: 'Fecha y Hora (Chile)', value: `${TimeHelpers.currentDay}, ${TimeHelpers.formatForEmbed()}`, inline: true }
                );

                const canalLogs = message.guild.channels.cache.get(config.logChannelID);
                if (!canalLogs) return message.reply('❌ No se pudo encontrar el canal de logs.');
                
                await canalLogs.send({ embeds: [embedLog] });
                message.reply(`✅ Título del log actualizado correctamente.`);
            } else {
                const nuevoMensaje = editArgs.join(' ');
                await db.query('UPDATE bot_versions SET changelog = ? WHERE id = ?', [nuevoMensaje, logId]);
                
                try {
                    await cache.del(LOG_CACHE_NAMESPACE, `log_${logId}`);
                } catch (cacheError) {
                    console.error('Cache delete error:', cacheError.message);
                }

                const embedLog = createEmbed(
                    nuevoMensaje,
                    'info',
                    `📝 Log Actualizado (ID: ${logId})`
                )
                .addFields(
                    { name: 'Componente', value: log.componente || 'N/A', inline: true },
                    { name: 'Fecha y Hora (Chile)', value: `${TimeHelpers.currentDay}, ${TimeHelpers.formatForEmbed()}`, inline: true }
                );

                const canalLogs = message.guild.channels.cache.get(config.logChannelID);
                if (!canalLogs) return message.reply('❌ No se pudo encontrar el canal de logs.');
                
                await canalLogs.send({ embeds: [embedLog] });
                message.reply(`✅ Log actualizado correctamente.`);
            }
        } catch (error) {
            console.error('Error editando el log:', error);
            message.reply('❌ Ocurrió un error al editar el log.');
        }
    },

    async handleBugCommand(message, args) {
        if (args.length < 1) {
            return message.reply('❌ Uso correcto: `!log bug <id> [resolver]`');
        }

        const [bugId, action] = args;

        try {
            let bug;
            try {
                bug = await cache.get(BUG_CACHE_NAMESPACE, bugId);
            } catch (cacheError) {
                console.error('Cache get error:', cacheError.message);
                bug = null;
            }
            
            if (!bug) {
                bug = await getBugById(bugId);
                if (!bug) {
                    return message.reply('❌ No se encontró un error con ese ID.');
                }
                try {
                    await cache.set(BUG_CACHE_NAMESPACE, bugId, bug, CACHE_TTL);
                } catch (cacheError) {
                    console.error('Cache set error:', cacheError.message);
                }
            }

            if (action && action.toLowerCase() === 'resolver') {
                if (bug.resolved) {
                    return message.reply('⚠️ Este error ya estaba marcado como resuelto.');
                }

                await resolveBug(bugId);
                
                try {
                    await cache.del(BUG_CACHE_NAMESPACE, bugId);
                } catch (cacheError) {
                    console.error('Cache delete error:', cacheError.message);
                }

                const embed = createEmbed(
                    `Error marcado como resuelto por ${message.author.tag}`,
                    'success',
                    `✅ Error Resuelto: ${bug.title}`
                )
                .addFields(
                    { name: 'ID', value: bugId, inline: true },
                    { name: 'Reportado por', value: bug.reported_by, inline: true },
                    { name: 'Fecha de reporte', value: `${TimeHelpers.currentDay}, ${TimeHelpers.formatForEmbed()}`, inline: true }
                );

                const canalLogs = message.guild.channels.cache.get(config.logChannelID);
                if (canalLogs) await canalLogs.send({ embeds: [embed] });
                
                return message.reply(`✅ Error ${bugId} marcado como resuelto.`);
            }

            const embed = createEmbed(
                bug.description,
                bug.resolved ? 'success' : 'error',
                `${bug.resolved ? '✅' : '🐛'} Error: ${bug.title}`
            )
            .addFields(
                { name: 'ID', value: bugId, inline: true },
                { name: 'Estado', value: bug.resolved ? 'Resuelto' : 'Pendiente', inline: true },
                { name: 'Reportado por', value: bug.reported_by, inline: true },
                { name: 'Fecha de reporte', value: `${TimeHelpers.currentDay}, ${TimeHelpers.formatForEmbed()}`, inline: true },
                { name: 'Fecha de resolución', value: bug.resolved_at ? TimeHelpers.formatDateTime(bug.resolved_at) : 'N/A', inline: true }
            );

            message.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Error gestionando el error:', error);
            message.reply('❌ Ocurrió un error al gestionar el error.');
        }
    }
};
