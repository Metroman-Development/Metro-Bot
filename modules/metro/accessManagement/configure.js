const path = require('path');
const fs = require('fs').promises;
const { EmbedBuilder } = require('discord.js');
const AccessCore = require('./accessCore');
const BatchConfigure = require('./batchConfigure');

class ConfigureHandler extends AccessCore {
    constructor() {
        super();
        this.batch = new BatchConfigure();
        this.currentSection = 'all';
        this.currentPage = 0;
        this.message = null;
        this.currentConfig = null;
        this.stationKey = '';
        this.normalizedKey = '';
        this.activeCollector = null;
        this.NAVIGATION_TIMEOUT = 120000;
        this.EDIT_TIMEOUT = 180000;
    }

    /* CORE METHODS */
    async handle(message, args) {
        try {
            this.cleanupCollectors();

            // Handle batch operations
            if (args[0]?.toLowerCase() === 'aedit') {
                return this.batch.handleAdvancedEdit.call(this, message, args.slice(1));
            }
            
            if (args[0]?.toLowerCase() === 'replace') {
                return this.batch.handleReplaceOperation.call(this, message, args.slice(1));
            }

            const parsedArgs = this.parseQuotedArgs(args);
            const rawName = parsedArgs[0];
            const rawLine = parsedArgs[1];
            
            if (!rawName || !rawLine) {
                return this.sendError(message, 
                    '❌ Debes especificar nombre de estación y línea\n' +
                    'Ejemplo: `configurar "Plaza Egaña" L4`\n' +
                    'O: `configurar Tobalaba L1`'
                );
            }

            await this.ensureAccessDetailsDir();
            this.stationKey = `${rawName} ${rawLine}`;
            this.normalizedKey = this.normalizeKey(this.stationKey);
            this.message = message;

            this.currentConfig = await this.getAccessConfig(this.normalizedKey);
            
            if (!this.currentConfig) {
                this.currentConfig = this.createNewConfig(rawName, rawLine);
                await this.saveAccessConfig(this.normalizedKey, this.currentConfig);
                return this.setupInitialConfigCollector(message);
            }

            this.currentPage = 0;
            this.currentSection = 'all';
            
            const totalItems = this.currentConfig.accesses.length + 
                             this.currentConfig.elevators.length + 
                             this.currentConfig.escalators.length;

            if (totalItems <= 10) {
                return this.showFullConfiguration();
            }
            return this.showPaginatedConfiguration();

        } catch (error) {
            console.error('Configuration Error:', error);
            this.cleanupCollectors();
            return this.sendError(message, 
                `❌ Error en configuración:\n\`\`\`${error.message}\`\`\``
            );
        }
    }

    /* CONFIGURATION MANAGEMENT */
    createNewConfig(stationName, line) {
        return {
            station: stationName,
            line: line,
            accesses: [],
            elevators: [],
            escalators: [],
            lastUpdated: new Date().toISOString(),
            changeHistory: [{
                timestamp: new Date().toISOString(),
                user: 'System',
                action: 'config_created',
                details: 'Configuración inicial creada'
            }]
        };
    }

    async setupInitialConfigCollector(message) {
        const collector = message.channel.createMessageCollector({
            filter: m => m.author.id === message.author.id,
            time: this.EDIT_TIMEOUT
        });

        this.activeCollector = collector;

        collector.on('collect', async (msg) => {
            try {
                const input = msg.content.trim();
                
                if (input.toLowerCase() === 'cancelar') {
                    collector.stop();
                    await message.reply('❌ Configuración cancelada');
                    return;
                }

                const config = await this.parseConfigurationInput(input, this.currentConfig.station, this.currentConfig.line);
                
                if (config.accesses.length === 0) {
                    await message.reply('❌ Debes incluir al menos 1 acceso');
                    return;
                }

                const confirm = await this.promptForConfirmation(
                    message,
                    "**Resumen de configuración:**\n" +
                    this.renderConfigPreview(config) +
                    "\n¿Confirmar esta configuración? (sí/no)"
                );

                if (confirm.toLowerCase() === 'sí' || confirm.toLowerCase() === 'si') {
                    config.changeHistory = [{
                        timestamp: new Date().toISOString(),
                        user: message.author.tag,
                        action: 'initial_config',
                        details: 'Configuración inicial'
                    }];

                    await this.saveAccessConfig(this.normalizedKey, config);
                    this.currentConfig = config;
                    collector.stop();
                    await message.reply(`✅ Configuración guardada para ${config.station} ${config.line}`);
                    return this.showFullConfiguration();
                }

                await message.reply('Por favor ingresa la configuración nuevamente o escribe "cancelar"');

            } catch (error) {
                await message.reply(
                    `❌ Error: ${error.message}\n` +
                    "Ejemplo válido:\n```\n" +
                    "Accesos: Acceso A (Descripción: Ubicación), Acceso B\n" +
                    "Ascensores: A: Calle→Boletería, Boletería→Andén\n" +
                    "```"
                );
            }
        });

        collector.on('end', () => {
            this.activeCollector = null;
        });
    }

    /* VIEW MANAGEMENT */
    async showFullConfiguration() {
        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle(`📝 Configuración completa: ${this.stationKey}`)
            .addFields(
                {
                    name: '🚪 Accesos',
                    value: this.currentConfig.accesses.slice(0, 5).map(a => 
                        `• **${a.name}** (${a.id})\n` +
                        `  - Estado: ${a.status || 'desconocido'}\n` +
                        `  - Descripción: ${a.description || 'N/A'}`
                    ).join('\n') || 'No hay accesos registrados',
                    inline: false
                },
                {
                    name: '🛗 Ascensores',
                    value: this.currentConfig.elevators.slice(0, 5).map(e => 
                        `• **${e.id}**: ${e.from} → ${e.to}\n` +
                        `  - Estado: ${e.status || 'desconocido'}\n` +
                        `  - Ruta: ${e.fullPath || 'N/A'}`
                    ).join('\n') || 'No hay ascensores registrados',
                    inline: false
                },
                {
                    name: '📶 Escaleras',
                    value: this.currentConfig.escalators.slice(0, 5).map(s => 
                        `• **${s.id}**: ${s.from} → ${s.to}\n` +
                        `  - Estado: ${s.status || 'desconocido'}\n` +
                        `  - Ruta: ${s.fullPath || 'N/A'}`
                    ).join('\n') || 'No hay escaleras registradas',
                    inline: false
                }
            )
            .setFooter({ 
                text: `Total: ${this.currentConfig.accesses.length} accesos | ` +
                      `${this.currentConfig.elevators.length} ascensores | ` +
                      `${this.currentConfig.escalators.length} escaleras`
            });

        const sentMessage = await this.message.reply({ 
            embeds: [embed],
            content: this.getNavigationInstructions()
        });
        await this.setupMessageCollector(sentMessage);
    }

    createPaginatedEmbed() {
        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle(`Configuración: ${this.stationKey}`)
            .setFooter({ 
                text: `Página ${this.currentPage + 1} | ${this.getSectionName(this.currentSection)}` 
            });

        const items = this.getCurrentPageItems();
        const totalItems = this.getTotalItems();

        if (items.length === 0) {
            embed.setDescription(`No hay ${this.currentSection} registrados`);
            return embed;
        }

        switch (this.currentSection) {
            case 'accesses':
                embed.setDescription(`**Accesos (${totalItems})**`);
                embed.addFields({
                    name: `Mostrando ${this.currentPage * 7 + 1}-${Math.min((this.currentPage + 1) * 7, totalItems)}`,
                    value: items.map(a => 
                        `• ${a.name} (${a.id})\n` +
                        `  Estado: ${a.status || 'desconocido'}\n` +
                        `  Descripción: ${a.description || 'N/A'}`
                    ).join('\n\n')
                });
                break;

            case 'elevators':
                embed.setDescription(`**Ascensores (${totalItems})**`);
                embed.addFields({
                    name: `Mostrando ${this.currentPage * 7 + 1}-${Math.min((this.currentPage + 1) * 7, totalItems)}`,
                    value: items.map(e => 
                        `• ${e.id}: ${e.from} → ${e.to}\n` +
                        `  Estado: ${e.status || 'desconocido'}\n` +
                        `  Ruta: ${e.fullPath || 'N/A'}`
                    ).join('\n\n')
                });
                break;

            case 'escalators':
                embed.setDescription(`**Escaleras (${totalItems})**`);
                embed.addFields({
                    name: `Mostrando ${this.currentPage * 7 + 1}-${Math.min((this.currentPage + 1) * 7, totalItems)}`,
                    value: items.map(s => 
                        `• ${s.id}: ${s.from} → ${s.to}\n` +
                        `  Estado: ${s.status || 'desconocido'}\n` +
                        `  Ruta: ${s.fullPath || 'N/A'}`
                    ).join('\n\n')
                });
                break;
        }

        return embed;
    }

    async showPaginatedConfiguration() {
        const embed = this.createPaginatedEmbed();
        const sentMessage = await this.message.reply({ 
            content: this.getNavigationInstructions(),
            embeds: [embed] 
        });
        await this.setupMessageCollector(sentMessage);
    }

    /* EDITING SYSTEM */
    async handleEditItem(message, item, itemType) {
        try {
            let continueEditing = true;
            
            while (continueEditing) {
                const currentState = this.formatItemForEditing(item, itemType);
                const embed = new EmbedBuilder()
                    .setColor(0xFFFF00)
                    .setTitle(`✏️ Editando ${item.id} (${this.getSectionName(itemType)})`)
                    .setDescription("**Estado actual:**\n" + currentState)
                    .addFields({
                        name: 'Instrucciones',
                        value: [
                            "Escribe cambios como:",
                            "`clave: valor` (ej: `status: fuera de servicio`)",
                            "`segmentoX: nuevo_valor` (ej: `segment1: Andén→Pasillo`)",
                            "`reemplazar: viejo→nuevo` (para reemplazar en rutas)",
                            "Opciones:",
                            "`listo` - Guardar cambios",
                            "`cancelar` - Descartar cambios",
                            "`ver` - Ver estado actual"
                        ].join('\n')
                    });

                await message.reply({ embeds: [embed] });

                const responses = await message.channel.awaitMessages({
                    filter: m => m.author.id === message.author.id,
                    max: 1,
                    time: this.EDIT_TIMEOUT
                });
                
                const input = responses.first().content.trim().toLowerCase();
                
                if (input === 'listo') {
                    this.updateItemInConfig(item.id, item, itemType);
                    await this.saveAccessConfig(this.normalizedKey, this.currentConfig);
                    await message.reply('✅ Cambios guardados correctamente');
                    return true;
                }
                
                if (input === 'cancelar') {
                    await message.reply('❌ Edición cancelada');
                    return false;
                }
                
                if (input === 'ver') continue;

                const changesMade = await this.processEditInput(input, item, itemType, message);
                
                if (changesMade) {
                    const confirm = await message.reply({ 
                        content: '✅ Cambio aplicado. ¿Quieres hacer más cambios? (sí/no)',
                        ephemeral: true 
                    });
                    
                    const confirmResponse = await message.channel.awaitMessages({
                        filter: m => m.author.id === message.author.id,
                        max: 1,
                        time: 30000
                    });
                    
                    continueEditing = confirmResponse.first().content.toLowerCase().startsWith('s');
                }
            }
            
            return true;
        } catch (error) {
            console.error('Edit Error:', error);
            await message.reply('❌ Error en el proceso de edición');
            return false;
        }
    }

    /* COLLECTOR MANAGEMENT */
    async setupMessageCollector(sentMessage) {
        this.cleanupCollectors();

        const collector = sentMessage.channel.createMessageCollector({
            filter: m => m.author.id === this.message.author.id,
            time: this.NAVIGATION_TIMEOUT
        });

        this.activeCollector = collector;

        collector.on('collect', async (msg) => {
            try {
                await msg.delete().catch(() => {});
                const input = msg.content.trim();
                
                if (input.toLowerCase() === 'ver') {
                    const currentView = this.currentSection === 'all' 
                        ? await this.showFullConfiguration() 
                        : await this.showPaginatedConfiguration();
                    return;
                }

                const response = await this.processCommand(input, msg);
                
                if (response.shouldExit) {
                    collector.stop();
                    return;
                }

                if (response.updateView) {
                    const newEmbed = this.currentSection === 'all'
                        ? this.createFullEmbed()
                        : this.createPaginatedEmbed();
                    
                    await sentMessage.edit({
                        content: this.getNavigationInstructions(),
                        embeds: [newEmbed]
                    });
                }

            } catch (error) {
                if (!this.isExpectedError(error)) {
                    await this.sendTemporaryReply(msg, `⚠️ ${this.cleanErrorMessage(error.message)}`);
                }
            }
        });

        collector.on('end', () => {
            this.activeCollector = null;
            try {
                sentMessage.edit({ content: "Sesión terminada", embeds: [] });
            } catch (error) {
                console.error("Error cleaning up message:", error);
            }
        });
    }

    /* UTILITY METHODS */
    getNavigationInstructions() {
        if (this.currentSection === 'all') {
            return [
                '**Comandos de navegación:**',
                '`accesos` - Mostrar accesos',
                '`ascensores` - Mostrar ascensores',
                '`escaleras` - Mostrar escaleras',
                '`salir` - Finalizar',
                '\n**Edición:**',
                '`editar [tipo] [id]` - Editar elemento',
                '`añadir [tipo]` - Añadir nuevo',
                '`eliminar [tipo] [id]` - Eliminar'
            ].join('\n');
        } else {
            return [
                '**Comandos:**',
                '`anterior`/`siguiente` - Navegar páginas',
                '`inicio` - Vista general',
                '`salir` - Finalizar',
                '\n**Edición:**',
                '`editar [id]` - Editar elemento',
                '`añadir` - Añadir nuevo',
                '`eliminar [id]` - Eliminar',
                '`ver` - Mostrar detalles'
            ].join('\n');
        }
    }

    formatItemForEditing(item, itemType) {
        let formatted = [];
        
        formatted.push(`• ID: ${item.id}`);
        if (item.status) formatted.push(`• Estado: ${item.status}`);
        if (item.notes) formatted.push(`• Notas: ${item.notes}`);
        
        switch (itemType) {
            case 'accesses':
                formatted.push(`• Nombre: ${item.name}`);
                if (item.description) formatted.push(`• Descripción: ${item.description}`);
                break;
                
            case 'elevators':
            case 'escalators':
                formatted.push(`• Desde: ${item.from}`);
                formatted.push(`• Hasta: ${item.to}`);
                if (item.fullPath) formatted.push(`• Ruta completa: ${item.fullPath}`);
                
                if (item.segments?.length > 0) {
                    formatted.push('\n**Segmentos:**');
                    item.segments.forEach((seg, i) => {
                        formatted.push(`• Segmento ${i+1}: ${seg.from}→${seg.to}`);
                    });
                }
                break;
        }
        
        return formatted.join('\n');
    }

    async processEditInput(input, item, itemType, message) {
        const keyValueMatch = input.match(/^([a-záéíóúñ]+)\s*:\s*(.+)$/i);
        if (keyValueMatch) {
            const [_, key, value] = keyValueMatch;
            const validKeys = this.getValidKeysForType(itemType);
            
            if (!validKeys.includes(key.toLowerCase())) {
                await message.reply(`❌ Clave inválida. Claves válidas: ${validKeys.join(', ')}`);
                return false;
            }
            
            if (key === 'from' || key === 'to') {
                await this.handlePathUpdate(item, key, value.trim());
            } else {
                item[key] = value.trim();
            }
            
            return true;
        }
        
        const segmentMatch = input.match(/^segmento?(\d+)\s*:\s*([^→]+)→([^→]+)$/i);
        if (segmentMatch) {
            const [_, index, from, to] = segmentMatch;
            const segIndex = parseInt(index) - 1;
            
            if (!item.segments || segIndex >= item.segments.length) {
                await message.reply(`❌ No existe el segmento ${index}`);
                return false;
            }
            
            item.segments[segIndex] = { from: from.trim(), to: to.trim() };
            this.rebuildFullPath(item);
            return true;
        }
        
        const replaceMatch = input.match(/^reemplazar\s*:\s*([^→]+)→([^→]+)$/i);
        if (replaceMatch) {
            const [_, oldVal, newVal] = replaceMatch;
            let changesMade = false;
            
            if (item.from?.includes(oldVal)) {
                item.from = item.from.replace(oldVal, newVal);
                changesMade = true;
            }
            if (item.to?.includes(oldVal)) {
                item.to = item.to.replace(oldVal, newVal);
                changesMade = true;
            }
            
            if (item.segments) {
                item.segments.forEach(seg => {
                    if (seg.from.includes(oldVal)) {
                        seg.from = seg.from.replace(oldVal, newVal);
                        changesMade = true;
                    }
                    if (seg.to.includes(oldVal)) {
                        seg.to = seg.to.replace(oldVal, newVal);
                        changesMade = true;
                    }
                });
            }
            
            if (changesMade) {
                this.rebuildFullPath(item);
                return true;
            }
            
            await message.reply('❌ No se encontró el texto a reemplazar');
            return false;
        }
        
        await message.reply('❌ Formato no reconocido');
        return false;
    }

    rebuildFullPath(item) {
        if (!item.segments?.length) {
            if (item.from && item.to) {
                item.fullPath = `${item.from}→${item.to}`;
            }
            return;
        }
        
        item.from = item.segments[0].from;
        item.to = item.segments[item.segments.length - 1].to;
        item.fullPath = item.segments.map(seg => `${seg.from}→${seg.to}`).join(', ');
    }

    /* COMPLETE PROCESSCOMMAND */
    async processCommand(input, originalMessage) {
        const response = { updateView: false, shouldExit: false };
        const normalizedInput = input.toLowerCase().trim();
        
        try {
            const navigationMap = {
                'accesos': 'accesses', 'access': 'accesses', 'a': 'accesses',
                'ascensores': 'elevators', 'elevators': 'elevators', 'e': 'elevators',
                'escaleras': 'escalators', 'escalators': 'escalators', 's': 'escalators',
                'inicio': 'all', 'home': 'all', 'h': 'all', 'general': 'all', 'g': 'all'
            };

            if (navigationMap[normalizedInput]) {
                this.currentSection = navigationMap[normalizedInput];
                this.currentPage = 0;
                response.updateView = true;
                return response;
            }

            if (['anterior', 'prev', 'p', 'atrás', 'back'].includes(normalizedInput)) {
                if (this.hasPreviousPage()) {
                    this.currentPage--;
                    response.updateView = true;
                } else {
                    await this.sendTemporaryReply(originalMessage, '⚠️ Ya estás en la primera página');
                }
                return response;
            }

            if (['siguiente', 'next', 'n', 'avanzar'].includes(normalizedInput)) {
                if (this.hasNextPage()) {
                    this.currentPage++;
                    response.updateView = true;
                } else {
                    await this.sendTemporaryReply(originalMessage, '⚠️ Ya estás en la última página');
                }
                return response;
            }

            if (normalizedInput.startsWith('editar ') || normalizedInput.startsWith('edit ')) {
                const parts = originalMessage.content.split(/\s+/);
                let type, id;
                
                if (this.currentSection === 'all') {
                    if (parts.length < 3) throw new Error('Formato: `editar [tipo] [id]`');
                    type = parts[1].toLowerCase();
                    id = parts[2];
                } else {
                    if (parts.length < 2) throw new Error('Formato: `editar [id]`');
                    type = this.currentSection;
                    id = parts[1];
                }

                if (type === 'accesos' || type === 'a') type = 'accesses';
                if (type === 'ascensores' || type === 'e') type = 'elevators';
                if (type === 'escaleras' || type === 's') type = 'escalators';

                const item = this.findItemById(id, type);
                if (!item) throw new Error(`No se encontró ${type.slice(0, -1)} con ID ${id}`);

                const success = await this.handleEditItem(originalMessage, item, type);
                response.updateView = success;
                return response;
            }

            if (normalizedInput === 'salir' || normalizedInput === 'exit') {
                response.shouldExit = true;
                return response;
            }

            if (!this.isActiveInteraction()) {
                const suggestion = this.getCommandSuggestion(normalizedInput);
                throw new Error(suggestion || 'Comando no reconocido. Escribe `ayuda` para ver opciones.');
            }

            return response;

        } catch (error) {
            if (!this.isExpectedError(error)) {
                console.error('Command Error:', error);
                await this.sendTemporaryReply(originalMessage, `⚠️ ${this.cleanErrorMessage(error.message)}`);
            }
            return response;
        }
    }

    /* HELPER METHODS */
    getValidKeysForType(itemType) {
        const baseKeys = ['id', 'status', 'notes'];
        
        switch (itemType) {
            case 'accesses': return [...baseKeys, 'name', 'description'];
            case 'elevators': case 'escalators': 
                return [...baseKeys, 'from', 'to', 'fullpath'];
            default: return baseKeys;
        }
    }

    getCommandSuggestion(input) {
        const commandMap = {
            'listo': 'Usa `listo` solo durante edición interactiva',
            '!stationaccess': 'Comando correcto: `!accesos estación "Nombre" Línea`',
            'ver todos': 'Para ver todo usa: `inicio` o `general`'
        };

        for (const [wrongCmd, suggestion] of Object.entries(commandMap)) {
            if (input.includes(wrongCmd)) return suggestion;
        }
        return null;
    }

    cleanupCollectors() {
        if (this.activeCollector) {
            this.activeCollector.stop();
            this.activeCollector = null;
        }
    }

    getSectionName(section) {
        const names = {
            'accesses': 'Accesos',
            'elevators': 'Ascensores',
            'escalators': 'Escaleras',
            'all': 'Vista General'
        };
        return names[section] || section;
    }

    getCurrentPageItems() {
        const items = this.currentConfig[this.currentSection] || [];
        const start = this.currentPage * 7;
        return items.slice(start, start + 7);
    }

    getTotalItems() {
        return this.currentConfig[this.currentSection]?.length || 0;
    }

    hasPreviousPage() {
        return this.currentPage > 0;
    }

    hasNextPage() {
        return (this.currentPage + 1) * 7 < this.getTotalItems();
    }

    findItemById(id, type) {
        const items = this.currentConfig[type];
        if (!items) return null;
        return items.find(item => item.id.toLowerCase() === id.toLowerCase());
    }

    updateItemInConfig(id, updatedItem, type) {
        const items = this.currentConfig[type];
        if (!items) return false;
        
        const index = items.findIndex(item => item.id === id);
        if (index === -1) return false;
        
        items[index] = updatedItem;
        this.currentConfig.lastUpdated = new Date().toISOString();
        
        this.currentConfig.changeHistory.push({
            timestamp: new Date().toISOString(),
            user: this.message.author.tag,
            action: `${type.slice(0, -1)}_updated`,
            details: `Updated ${id}`
        });
        
        return true;
    }

    isExpectedError(error) {
        const expectedErrors = [
            'Comando no reconocido',
            'Ya estás en la',
            'Formato:'
        ];
        return expectedErrors.some(e => error.message.includes(e));
    }

    cleanErrorMessage(msg) {
        return msg.length > 1000 ? msg.substring(0, 1000) + '...' : msg;
    }

    async sendTemporaryReply(message, content, timeout = 10000) {
        const reply = await message.reply(content);
        setTimeout(() => reply.delete().catch(() => {}), timeout);
        return reply;
    }

    async promptForConfirmation(message, promptText) {
        const prompt = await message.reply(promptText);
        const responses = await message.channel.awaitMessages({
            filter: m => m.author.id === message.author.id,
            max: 1,
            time: 30000
        });
        
        await prompt.delete().catch(() => {});
        return responses.first()?.content || '';
    }

    renderConfigPreview(config) {
        return [
            `**Estación:** ${config.station} ${config.line}`,
            `**Accesos:** ${config.accesses.map(a => a.name).join(', ')}`,
            `**Ascensores:** ${config.elevators.length}`,
            `**Escaleras:** ${config.escalators.length}`
        ].join('\n');
    }

    async parseConfigurationInput(input, stationName, line) {
        const config = {
            station: stationName,
            line: line,
            accesses: [],
            elevators: [],
            escalators: [],
            lastUpdated: new Date().toISOString(),
            changeHistory: []
        };

        const clean = (str) => str.trim().replace(/\s+/g, ' ').replace(/[“”]/g, '"');

        const accessRegex = /Accesos:\s*((?:(?!\n[Aa]scensores?:)[\s\S])*)/i;
        const accessMatch = input.match(accessRegex);
        
        if (accessMatch && accessMatch[1]) {
            config.accesses = accessMatch[1].split(',')
                .map(item => {
                    const trimmed = clean(item);
                    if (!trimmed) return null;
                    
                    const descMatch = trimmed.match(/(.*?)\s*\([Dd]escripción:\s*([^)]+)\)/);
                    const name = clean(descMatch ? descMatch[1] : trimmed);
                    const description = clean(descMatch ? descMatch[2] : '');
                    
                    let id = name.replace(/Acceso\s*/i, '').replace(/[^a-z0-9áéíóúñ]/gi, '');

                    return {
                        id: id || `A${config.accesses.length + 1}`,
                        name: name,
                        description: description,
                        status: 'operativo',
                        notes: '',
                        lastUpdated: new Date().toISOString()
                    };
                })
                .filter(Boolean);
        }

        const elevatorRegex = /Ascensores:\s*((?:(?!\nEscaleras?:)[\s\S])*)/i;
        const elevatorMatch = input.match(elevatorRegex);
        
        if (elevatorMatch && elevatorMatch[1]) {
            const entries = elevatorMatch[1].split(/(?<=[^,])\s+(?=[A-Za-z0-9]+:)/)
                .flatMap(entry => entry.split(','))
                .map(clean)
                .filter(Boolean);
            
            for (const entry of entries) {
                const [idPart, ...pathParts] = entry.split(':');
                const id = clean(idPart);
                const pathStr = clean(pathParts.join(':'));
                
                if (!id || !pathStr) continue;
                
                try {
                    const { from, to } = this.parsePathSegment(pathStr);
                    config.elevators.push({
                        id: id,
                        from: from,
                        to: to,
                        fullPath: `${from}→${to}`,
                        segments: [{ from, to }],
                        status: 'operativo',
                        notes: '',
                        lastUpdated: new Date().toISOString()
                    });
                } catch (error) {
                    console.error(`Error parsing elevator ${id}: ${error.message}`);
                }
            }
        }

        if (config.accesses.length === 0) {
            throw new Error("Debe incluir al menos 1 acceso");
        }

        return config;
    }

    parsePathSegment(pathStr) {
        const parts = pathStr.split('→').map(p => p.trim());
        if (parts.length !== 2 || !parts[0] || !parts[1]) {
            throw new Error(`Formato de ruta inválido: ${pathStr}`);
        }
        return { from: parts[0], to: parts[1] };
    }

    isActiveInteraction() {
        return !!this.activeCollector;
    }
}

module.exports = ConfigureHandler;
