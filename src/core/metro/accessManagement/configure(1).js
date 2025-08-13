const path = require('path');
const fs = require('fs').promises;
const { EmbedBuilder } = require('discord.js');
const AccessCore = require('./accessCore');

class ConfigureHandler extends AccessCore {
    constructor() {
        super();
        this.currentSection = 'all';
        this.currentPage = 0;
        this.message = null;
        this.currentConfig = null;
        this.stationKey = '';
        this.normalizedKey = '';
        this.activeCollector = null;
    }

    // Main Handler with Advanced Edit
    async handle(message, args) {
        try {
            if (args[0]?.toLowerCase() === 'aedit') {
                return this.handleAdvancedEdit(message, args.slice(1));
            }
            
            if (args[0]?.toLowerCase() === 'replace') {
                return this.handleReplaceOperation(message, args.slice(1));
            }

            const parsedArgs = this.parseQuotedArgs(args);
            const rawName = parsedArgs[0];
            const rawLine = parsedArgs[1];
            
            if (!rawName || !rawLine) {
                return this.sendError(message, 'Debes especificar nombre de estación y línea (ej: "San Pablo" l1)');
            }

            await this.ensureAccessDetailsDir();

            this.stationKey = `${rawName} ${rawLine}`;
            this.normalizedKey = this.normalizeKey(this.stationKey);
            this.currentConfig = await this.getAccessConfig(this.normalizedKey);

            if (!this.currentConfig) {
                this.currentConfig = {
                    station: rawName,
                    line: rawLine,
                    accesses: [],
                    elevators: [],
                    elevatorsById: [], 
                    escalators: [],
                    changeHistory: [],
                    lastUpdated: new Date().toISOString()
                };
                
                await this.saveAccessConfig(this.normalizedKey, this.currentConfig);
                return this.promptForConfiguration(message, this.normalizedKey, this.currentConfig);
            }

            this.message = message;
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
            return this.sendError(message, `❌ Error: ${error.message}`);
        }
    }

    /* ===================================== */
    /* NEW REPLACE OPERATION */
    /* ===================================== */
    async handleReplaceOperation(message, args) {
        try {
            const params = this.parseReplaceParams(args);
            if (!params.valid) {
                return this.sendError(message,
                    `❌ Sintaxis incorrecta. Ejemplo:\n` +
                    '`!stationaccess replace [target] [property] "old" with "new" [filters]`\n' +
                    'Ejemplo real:\n' +
                    '`!stationaccess replace all description "Av." with "Avenida" in stations including "l1"`'
                );
            }

            const files = await fs.readdir(path.join(__dirname, '../../data/json/accessDetails'));
            const results = [];
            let totalModified = 0;

            for (const file of files) {
                if (!file.endsWith('.json')) continue;

                const filePath = path.join(__dirname, '../../data/json/accessDetails', file);
                const config = JSON.parse(await fs.readFile(filePath, 'utf8'));

                // Apply station filter
                if (params.stationFilter && 
                    !config.station.toLowerCase().includes(params.stationFilter.toLowerCase())) {
                    continue;
                }

                const modified = this.processTextReplace(config, params);
                if (modified > 0) {
                    totalModified++;
                    await fs.writeFile(filePath, JSON.stringify(config, null, 2));
                    results.push(`✅ ${config.station} ${config.line}: ${modified} cambios`);
                }
            }

            const embed = new EmbedBuilder()
                .setColor(totalModified > 0 ? 0x00FF00 : 0xFFA500)
                .setTitle(`🔧 Resultados de reemplazo`)
                .setDescription(
                    `Estaciones modificadas: **${totalModified}**\n` +
                    `**Cambio:** \`${params.oldValue}\` → \`${params.newValue}\``
                );

            if (results.length > 0) {
                const chunks = [];
                for (let i = 0; i < results.length; i += 5) {
                    chunks.push(results.slice(i, i + 5));
                }
                chunks.forEach((chunk, i) => {
                    embed.addFields({
                        name: `Cambios ${i+1}/${chunks.length}`,
                        value: chunk.join('\n'),
                        inline: false
                    });
                });
            }

            return message.reply({ embeds: [embed] });

        } catch (error) {
            console.error('Replace Error:', error);
            return this.sendError(message, `❌ Error en reemplazo: ${error.message}`);
        }
    }

    parseReplaceParams(args) {
        const params = {
            valid: false,
            target: 'all',
            property: null,
            oldValue: null,
            newValue: null,
            isRegex: false,
            stationFilter: null,
            condition: null
        };

        try {
            let i = 0;
            
            // Parse target
            if (i < args.length) {
                params.target = args[i++].toLowerCase();
            }

            // Parse property
            if (i < args.length) {
                params.property = args[i++].toLowerCase();
            }

            // Parse old value
            if (i < args.length) {
                const val = args[i];
                if (val.startsWith('/') && val.endsWith('/')) {
                    params.oldValue = new RegExp(val.slice(1, -1), 'gi');
                    params.isRegex = true;
                } else {
                    params.oldValue = val.replace(/^["']|["']$/g, '');
                }
                i++;
            }

            // Expect "with" keyword
            if (i >= args.length || args[i++].toLowerCase() !== 'with') {
                return params;
            }

            // Parse new value
            if (i < args.length) {
                params.newValue = args[i].replace(/^["']|["']$/g, '');
                i++;
            }

            // Parse optional filters
            while (i < args.length) {
                if (args[i]?.toLowerCase() === 'in' && args[i+1]?.toLowerCase() === 'stations') {
                    i += 2;
                    if (args[i]?.toLowerCase() === 'including') {
                        i++;
                        params.stationFilter = args[i++].replace(/^["']|["']$/g, '');
                    }
                }
                else if (args[i]?.toLowerCase() === 'if') {
                    i++;
                    params.condition = {
                        property: args[i++],
                        operator: args[i++]?.toLowerCase(),
                        value: args[i++].replace(/^["']|["']$/g, '')
                    };
                }
                else {
                    i++;
                }
            }

            params.valid = !!params.property && params.oldValue !== null && params.newValue !== null;
            return params;

        } catch (error) {
            console.error('Replace Parse Error:', error);
            return params;
        }
    }

    processTextReplace(config, params) {
        let modified = 0;
        const elements = [];

        // Select target elements
        if (params.target === 'all') {
            elements.push(...config.accesses, ...config.elevators, ...config.escalators);
        } else if (config[params.target]) {
            elements.push(...config[params.target]);
        }

        // Process each element
        for (const element of elements) {
            // Check conditions
            if (params.condition) {
                const elementValue = String(element[params.condition.property] || '').toLowerCase();
                const conditionValue = params.condition.value.toLowerCase();
                
                let matches;
                switch (params.condition.operator) {
                    case 'equals': matches = elementValue === conditionValue; break;
                    case 'includes': matches = elementValue.includes(conditionValue); break;
                    case 'startswith': matches = elementValue.startsWith(conditionValue); break;
                    case 'endswith': matches = elementValue.endsWith(conditionValue); break;
                    case 'matches': 
                        try {
                            matches = new RegExp(conditionValue, 'i').test(elementValue);
                        } catch {
                            matches = false;
                        }
                        break;
                    default: matches = false;
                }
                if (!matches) continue;
            }

            // Perform replacement
            const originalValue = element[params.property];
            if (typeof originalValue !== 'string') continue;

            let newValue;
            if (params.isRegex) {
                newValue = originalValue.replace(params.oldValue, params.newValue);
            } else {
                newValue = originalValue.replace(
                    new RegExp(this.escapeRegExp(params.oldValue), 'g'), 
                    params.newValue
                );
            }

            if (newValue !== originalValue) {
                element[params.property] = newValue;
                element.lastUpdated = new Date().toISOString();
                modified++;

                // Record change
                config.changeHistory.push({
                    timestamp: new Date().toISOString(),
                    user: `${this.message.author.tag} (Replace)`,
                    action: 'Reemplazo de texto',
                    details: `${element.id}: ${params.property} "${originalValue}" → "${newValue}"`
                });
            }
        }

        if (modified > 0) {
            config.lastUpdated = new Date().toISOString();
        }

        return modified;
    }

    // Fixed Reaction Handling
    async showPaginatedConfiguration() {
        // 1. Clean up any existing collector
        if (this.activeCollector) {
            console.log('[DEBUG] Stopping previous collector');
            this.activeCollector.stop();
            this.activeCollector = null;
        }

        // 2. Create and send embed
        const embed = this.createPaginatedEmbed();
        const sentMessage = await this.message.reply({ embeds: [embed] });
        console.log(`[DEBUG] Message created with ID: ${sentMessage.id}`);

        // 3. Clear existing reactions with error handling
        try {
            await sentMessage.reactions.removeAll();
            console.log('[DEBUG] Cleared existing reactions');
        } catch (error) {
            console.error('[ERROR] Failed to clear reactions:', error);
        }

        // 4. Add reactions with delay and verification
        const reactionsToAdd = this.currentSection === 'all' 
            ? ['🚪', '🛗', '🔼', '❌'] 
            : [
                ...(this.hasPreviousPage() ? ['⬅️'] : []),
                ...(this.hasNextPage() ? ['➡️'] : []),
                '🏠', '❌'
            ];

        console.log(`[DEBUG] Adding reactions: ${reactionsToAdd.join(', ')}`);
        
        for (const reaction of reactionsToAdd) {
            try {
                await sentMessage.react(reaction);
                console.log(`[DEBUG] Added reaction: ${reaction}`);
                await new Promise(resolve => setTimeout(resolve, 750)); // Increased delay
            } catch (error) {
                console.error(`[ERROR] Failed to add ${reaction}:`, error);
            }
        }

        // 5. Create collector with enhanced debugging
        console.log('[DEBUG] Creating new collector');
        
        const filter = (reaction, user) => {
            const isBot = user.bot;
            const isAuthor = user.id === this.message.author.id;
            const isValidEmoji = ['🚪', '🛗', '🔼', '⬅️', '➡️', '🏠', '❌'].includes(reaction.emoji.name);
            
            console.log(`[DEBUG] Reaction filter check - User: ${user.tag} (Bot: ${isBot}), Emoji: ${reaction.emoji.name}, Valid: ${isValidEmoji}`);
            
            return !isBot && isAuthor && isValidEmoji;
        };

        this.activeCollector = sentMessage.createReactionCollector({ 
            filter,
            dispose: false, // Simpler for debugging
            time: 120000,
            idle: 30000
        });

        // 6. Collector event handlers with detailed logging
        this.activeCollector
            .on('collect', async (reaction, user) => {
                console.log(`[DEBUG] Collected ${reaction.emoji.name} from ${user.tag}`);
                
                try {
                    // Process reaction
                    switch (reaction.emoji.name) {
                        // ... (keep your existing switch cases)
                    }

                    // Update message
                    const newEmbed = this.createPaginatedEmbed();
                    await sentMessage.edit({ embeds: [newEmbed] });
                    console.log('[DEBUG] Message updated');

                    // Don't manage reactions reactively for now - simplify debugging
                } catch (error) {
                    console.error('[ERROR] In collector handler:', error);
                }
            })
            .on('end', (collected, reason) => {
                console.log(`[DEBUG] Collector ended. Reason: ${reason}`);
                console.log(`Collected reactions: ${collected.size}`);
                this.activeCollector = null;
                
                // Optional: Clean up reactions when done
                sentMessage.reactions.removeAll().catch(e => console.error('Cleanup error:', e));
            });

        console.log('[DEBUG] Collector setup complete');
    }
    
    // Pagination Helpers
    hasPreviousPage() {
        return this.currentPage > 0;
    }

    hasNextPage() {
        switch (this.currentSection) {
            case 'accesses':
                return (this.currentPage + 1) * 7 < this.currentConfig.accesses.length;
            case 'elevators':
                return (this.currentPage + 1) * 7 < this.currentConfig.elevators.length;
            case 'escalators':
                return (this.currentPage + 1) * 7 < this.currentConfig.escalators.length;
            default:
                return false;
        }
    }

    getSectionName(section) {
        switch (section) {
            case 'accesses': return 'Accesos';
            case 'elevators': return 'Ascensores';
            case 'escalators': return 'Escaleras';
            default: return 'General';
        }
    }

    createPaginatedEmbed() {
        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle(`Configuración: ${this.stationKey}`)
            .setFooter({ 
                text: `Página ${this.currentPage + 1} | Sección: ${this.getSectionName(this.currentSection)}` 
            });

        switch (this.currentSection) {
            case 'accesses':
                embed.setDescription('**Accesos**');
                embed.addFields(this.getAccessesPage());
                break;
            case 'elevators':
                embed.setDescription('**Ascensores**');
                embed.addFields(this.getElevatorsPage());
                break;
            case 'escalators':
                embed.setDescription('**Escaleras**');
                embed.addFields(this.getEscalatorsPage());
                break;
            default:
                embed.setDescription('**Vista general**\nSelecciona una sección para ver detalles');
                embed.addFields(
                    { 
                        name: 'Accesos', 
                        value: `${this.currentConfig.accesses.length} registrados\n🚪 para ver`, 
                        inline: true 
                    },
                    { 
                        name: 'Ascensores', 
                        value: `${this.currentConfig.elevators.length} registrados\n🛗 para ver`, 
                        inline: true 
                    },
                    { 
                        name: 'Escaleras', 
                        value: `${this.currentConfig.escalators.length} registradas\n🔼 para ver`, 
                        inline: true 
                    }
                );
        }

        return embed;
    }

    getAccessesPage() {
        const startIdx = this.currentPage * 7;
        const pageItems = this.currentConfig.accesses.slice(startIdx, startIdx + 7);
        return {
            name: `Accesos (${startIdx + 1}-${startIdx + pageItems.length} de ${this.currentConfig.accesses.length})`,
            value: pageItems.map(a => `• ${a.name} (${a.id})`).join('\n') || 'No hay accesos',
            inline: false
        };
    }

    getElevatorsPage() {
        const startIdx = this.currentPage * 7;
        const pageItems = this.currentConfig.elevators.slice(startIdx, startIdx + 7);
        return {
            name: `Ascensores (${startIdx + 1}-${startIdx + pageItems.length} de ${this.currentConfig.elevators.length})`,
            value: pageItems.map(e => `• ${e.id}: ${e.from} → ${e.to}`).join('\n') || 'No hay ascensores',
            inline: false
        };
    }

    getEscalatorsPage() {
        const startIdx = this.currentPage * 7;
        const pageItems = this.currentConfig.escalators.slice(startIdx, startIdx + 7);
        return {
            name: `Escaleras (${startIdx + 1}-${startIdx + pageItems.length} de ${this.currentConfig.escalators.length})`,
            value: pageItems.map(e => `• ${e.id}: ${e.from} → ${e.to}`).join('\n') || 'No hay escaleras',
            inline: false
        };
    }

    // Display Methods
    async showFullConfiguration() {
        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle(`Configuración actual: ${this.stationKey}`)
            .addFields(
                { 
                    name: 'Accesos', 
                    value: this.formatAccesses(this.currentConfig.accesses) || 'Ninguno', 
                    inline: true 
                },
                { 
                    name: 'Ascensores', 
                    value: this.formatElevators(this.currentConfig.elevators) || 'Ninguno', 
                    inline: true 
                },
                { 
                    name: 'Escaleras', 
                    value: this.formatEscalators(this.currentConfig.escalators) || 'Ninguna', 
                    inline: true 
                }
            )
            .setFooter({ text: 'Responde con "editar [tipo] [id]" o "añadir [tipo]" o "cancelar"' });

        return this.message.reply({ embeds: [embed] });
    }

    formatAccesses(accesses) {
        return accesses.map(a => `• ${a.name} (${a.id})`).join('\n') || 'Ninguno';
    }

    formatElevators(elevators) {
        return elevators.map(e => `• ${e.id}: ${e.from} → ${e.to}`).join('\n') || 'Ninguno';
    }

    formatEscalators(escalators) {
        return escalators.map(e => `• ${e.id}: ${e.from} → ${e.to}`).join('\n') || 'Ninguna';
    }

    // Configuration Methods
    async promptForConfiguration(message, stationKey, currentConfig) {
        const embed = new EmbedBuilder()
            .setColor(0xFFFF00)
            .setTitle(`🛗 Configuración inicial para ${currentConfig.station} ${currentConfig.line}`)
            .setDescription([
                '**Formato requerido:**',
                '```',
                'Accesos: Acceso A (Descripción: Ubicación), Acceso B',
                'Ascensores: ID: From→To, From→To, ID2: From→To',
                'Escaleras: ID: From→To, From→To',
                '```',
                'Ejemplo real:',
                '```',
                'Accesos: Acceso A (Descripción: Av. Alameda), Acceso B (Descripción: Av. María Rozas)',
                'Ascensores: LD: Andén Los Dominicos→Boletería, SP: Andén San Pablo→Boletería',
                'Escaleras: 1: Andén→Boletería, 2: Boletería→Calle',
                '```',
                'Separa múltiples elementos con comas. Escribe "cancelar" para terminar.'
            ].join('\n'));

        const prompt = await message.reply({ embeds: [embed] });
        return this.waitForInitialConfiguration(message, prompt, stationKey, currentConfig);
    }

    async waitForInitialConfiguration(message, prompt, stationKey, currentConfig) {
        const MAX_ATTEMPTS = 3;
        let attempts = 0;
        
        while (attempts < MAX_ATTEMPTS) {
            try {
                const responses = await message.channel.awaitMessages({
                    filter: m => m.author.id === message.author.id,
                    max: 1,
                    time: 300000,
                    errors: ['time']
                });

                const response = responses.first().content;
                if (response.toLowerCase() === 'cancelar') {
                    return this.sendSuccess(message, '❌ Configuración cancelada');
                }

                const config = await this.parseConfigurationInput(response, currentConfig.station, currentConfig.line);
                
                if (config.accesses.length === 0) {
                    throw new Error("Debe incluir al menos 1 acceso");
                }

                const confirm = await this.promptForConfirmation(
                    message,
                    "**Resumen de configuración:**\n" +
                    this.renderConfigPreview(config) +
                    "\n¿Confirmar esta configuración? (sí/no/cancelar)"
                );

                if (confirm.toLowerCase() === 'cancelar') {
                    return this.sendSuccess(message, '❌ Configuración cancelada');
                } else if (confirm.toLowerCase() === 'sí' || confirm.toLowerCase() === 'si') {
                    config.changeHistory = [{
                        timestamp: new Date().toISOString(),
                        user: message.author.tag,
                        action: 'Configuración inicial',
                        details: 'Creación de archivo de accesibilidad'
                    }];

                    await this.saveAccessConfig(stationKey, config);
                    return this.sendSuccess(message, `✅ Configuración guardada para ${config.station} ${config.line}`);
                } else {
                    attempts++;
                    await message.reply(`Intento ${attempts}/${MAX_ATTEMPTS}. Por favor reintente.`);
                }
            } catch (error) {
                if (error.name === 'TimeoutError') {
                    return this.sendError(message, 'Tiempo agotado. Por favor intenta nuevamente.');
                }
                attempts++;
                await message.reply(
                    `❌ Error: ${error.message}\n` +
                    `Intento ${attempts}/${MAX_ATTEMPTS}. Por favor corrija:\n` +
                    "Ejemplo válido:\n" +
                    "```\n" +
                    "Accesos: Acceso A (Descripción: Ubicación), Acceso B\n" +
                    "Ascensores: A: Calle→Boletería, Boletería→Andén\n" +
                    "```\n" +
                    "Escribe 'cancelar' para terminar."
                );
            }
        }
        
        return this.sendError(message, 'Máximo de intentos alcanzado. Comando cancelado.');
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

        const clean = (str) => str.trim().replace(/\s+/g, ' ');

        // Parse Access Points
        const accessSection = input.match(/Accesos:\s*([^]*?)(?=\nAscensores:|$)/is);
        if (accessSection) {
            config.accesses = accessSection[1].split(',')
                .map(item => {
                    const trimmed = clean(item);
                    if (!trimmed) return null;
                    
                    const descMatch = trimmed.match(/(.*?)\s*\(Descripción:\s*([^)]+)\)/i);
                    const name = descMatch ? clean(descMatch[1]) : trimmed;
                    const description = descMatch ? clean(descMatch[2]) : '';
                    
                    let id = name.startsWith('Acceso ') 
                        ? name.split(' ')[1] 
                        : name.replace(/Acceso/gi, '').trim();
                    
                    id = id.replace(/[^a-z0-9áéíóúñ]/gi, '');

                    return {
                        id,
                        name,
                        description,
                        status: 'abierto',
                        lastUpdated: new Date().toISOString(),
                        notes: ''
                    };
                })
                .filter(Boolean);
        }

        // Parse Elevators
        const elevatorSection = input.match(/Ascensores:\s*([^]*?)(?=\nEscaleras:|$)/is);
        if (elevatorSection) {
            const normalizedInput = elevatorSection[1].replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
            const elevatorEntries = normalizedInput.split(/(?<=]),\s*(?=[A-Za-z0-9]+:)|(?<=\S)\s+(?=[A-Za-z0-9]+:)/);
            
            for (const entry of elevatorEntries) {
                const colonIndex = entry.indexOf(':');
                if (colonIndex === -1) continue;
                
                const id = clean(entry.substring(0, colonIndex));
                const pathStr = clean(entry.substring(colonIndex + 1));
                
                if (!id || !pathStr) continue;
                
                try {
                    const { from, to, fullPath, segments } = this.parsePath(pathStr);
                    config.elevators.push({
                        id,
                        from,
                        to,
                        fullPath,
                        segments,
                        status: 'operativa',
                        lastUpdated: new Date().toISOString(),
                        notes: ''
                    });
                } catch (error) {
                    console.error(`Error parsing elevator ${id}: ${pathStr} - ${error.message}`);
                }
            }
        }

        // Parse Escalators
        const escalatorSection = input.match(/Escaleras:\s*([^]*?)(?=\n|$)/is);
        if (escalatorSection) {
            const normalizedInput = escalatorSection[1].replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
            const escalatorEntries = normalizedInput.split(/(?<=]),\s*(?=[A-Za-z0-9]+:)|(?<=\S)\s+(?=[A-Za-z0-9]+:)/);
            
            for (const entry of escalatorEntries) {
                const colonIndex = entry.indexOf(':');
                if (colonIndex === -1) continue;
                
                const id = clean(entry.substring(0, colonIndex));
                const pathStr = clean(entry.substring(colonIndex + 1));
                
                if (!id || !pathStr) continue;
                
                try {
                    const { from, to, fullPath, segments } = this.parsePath(pathStr);
                    config.escalators.push({
                        id,
                        from,
                        to,
                        fullPath,
                        segments,
                        status: 'operativa',
                        lastUpdated: new Date().toISOString(),
                        notes: ''
                    });
                } catch (error) {
                    console.error(`Error parsing escalator ${id}: ${pathStr} - ${error.message}`);
                }
            }
        }

        if (config.accesses.length === 0) {
            throw new Error("Debe incluir al menos 1 acceso");
        }

        return config;
    }

    // ADVANCED EDIT CORE FUNCTIONALITY
    async handleAdvancedEdit(message, args) {
        this.message = message;
        
    console.log(`\n[ADVANCED EDIT STARTED] ${message.author.tag} | Args: ${args.join(' ')}`);
    
    try {
        // 1. Parse Command
        console.log('[STEP 1/4] Parsing command...');
        const params = this.parseAdvancedEditParams(args);
        
        if (!params.valid) {
            console.error('[ERROR] Invalid parameters:', params.error);
            return this.sendError(message, 
                `❌ Syntax error. Example:\n` +
                `\`!stationaccess aedit [target] [property] to "value" ` +
                `[if property operator "value"]\``
            );
        }

        // 2. Dry-run check (safety feature)
        const isDryRun = args.includes('dryrun');
        if (isDryRun) {
            console.log('[DRY RUN MODE] Changes will not be saved');
        }

        // 3. Process Files
        console.log('[STEP 2/4] Scanning station files...');
        const accessDir = path.join(__dirname, '../data/json/accessDetails');
        const files = await fs.readdir(accessDir);
        const accessFiles = files.filter(f => f.startsWith('access_') && f.endsWith('.json'));
        
        if (accessFiles.length === 0) {
            console.error('[ERROR] No station files found');
            return this.sendError(message, 'No station data available');
        }

        // 4. Batch Processing
        console.log(`[STEP 3/4] Processing ${accessFiles.length} files...`);
        const results = [];
        const changeSummary = {
            totalModified: 0,
            stationsModified: 0,
            elementsByType: { accesses: 0, elevators: 0, escalators: 0 }
        };

        for (const file of accessFiles) {
            const filePath = path.join(accessDir, file);
            console.log(`\n[PROCESSING] ${file}`);
            
            try {
                const config = JSON.parse(await fs.readFile(filePath, 'utf8'));
                const originalJson = JSON.stringify(config);

                // Apply edits
                const modifiedCount = this.processBatchEdit(config, params);
                
                if (modifiedCount > 0) {
                    // Track changes
                    changeSummary.totalModified += modifiedCount;
                    changeSummary.stationsModified++;
                    
                    // Update element type counts
                    if (params.target === 'all') {
                        changeSummary.elementsByType.accesses += (config.accesses || []).filter(a => a.lastUpdated === new Date().toISOString()).length;
                        changeSummary.elementsByType.elevators += (config.elevators || []).filter(e => e.lastUpdated === new Date().toISOString()).length;
                        changeSummary.elementsByType.escalators += (config.escalators || []).filter(s => s.lastUpdated === new Date().toISOString()).length;
                    }

                    // Save changes unless dry-run
                    if (!isDryRun) {
                        await fs.writeFile(filePath, JSON.stringify(config, null, 2));
                        console.log(`[SAVED] ${modifiedCount} changes`);
                    } else {
                        console.log(`[DRY RUN] Would save ${modifiedCount} changes`);
                    }

                    results.push(`🛠 **${config.station} ${config.line}**: ${modifiedCount} edits`);
                }
            } catch (err) {
                console.error(`[FILE ERROR] ${file}:`, err);
            }
        }

        // 5. Send Results
        console.log('[STEP 4/4] Generating report...');
        const elapsed = ((Date.now() - performance.now()) / 1000).toFixed(2);
        
        if (changeSummary.totalModified === 0) {
            console.log('[COMPLETE] No changes made');
            return this.sendSuccess(message, 'No elements matched your criteria');
        }

        const embed = new EmbedBuilder()
            .setColor(isDryRun ? 0xFFFF00 : 0x00FF00)
            .setTitle(`${isDryRun ? 'DRY RUN: ' : ''}Batch Edit Complete`)
            .setDescription([
                `⏱ **Time**: ${elapsed}s`,
                `🏭 **Stations Modified**: ${changeSummary.stationsModified}`,
                `📊 **Total Changes**: ${changeSummary.totalModified}`,
                `├─ Accesses: ${changeSummary.elementsByType.accesses}`,
                `├─ Elevators: ${changeSummary.elementsByType.elevators}`,
                `└─ Escalators: ${changeSummary.elementsByType.escalators}`,
                isDryRun ? '\n⚠ **Dry Run**: No changes saved' : ''
            ].join('\n'));

        // Paginate results if many stations
        const chunks = [];
        for (let i = 0; i < results.length; i += 5) {
            chunks.push(results.slice(i, i + 5));
        }

        chunks.forEach((chunk, i) => {
            embed.addFields({
                name: `Modified Stations ${i + 1}/${chunks.length}`,
                value: chunk.join('\n'),
                inline: false
            });
        });

        // Add edit summary
        embed.addFields({
            name: 'Edit Summary',
            value: [
                '```diff',
                `! ${params.target} ${params.property}`,
                `+ Changed to: "${params.newValue}"`,
                params.condition ? `? Condition: ${params.condition.property} ${params.condition.operator} "${params.condition.value}"` : '',
                '```'
            ].filter(Boolean).join('\n')
        });

        console.log('[COMPLETE] Sending results');
        return message.reply({ embeds: [embed] });

    } catch (error) {
        console.error('[FATAL ERROR]', error);
        return this.sendError(message, `❌ Critical error: ${error.message}`);
    }
}

    parseAdvancedEditParams(args) {
    console.log('[AEDIT PARSER] Starting parse with args:', args.join(' '));
    
    const params = {
        valid: false,
        target: null,
        elementId: null, 
        property: null,
        newValue: null,
        stationFilter: null,
        condition: null
    };

    try {
        let i = 0;
        const validTargets = ['all', 'accesses', 'elevators', 'escalators'];
        const validProperties = ['name', 'description', 'status', 'notes', 'from', 'to', 'fullpath'];

        // 1. Parse target (required)
        params.target = args[i++]?.toLowerCase();
        if (!validTargets.includes(params.target)) {
            console.error('[PARSER ERROR] Invalid target:', params.target);
            return params;
        }

        // 2. Parse property (required) - SKIP element ID parsing entirely
        // Since we don't actually use element IDs in current implementation
        params.property = args[i++]?.toLowerCase();
        if (!validProperties.includes(params.property)) {
            console.error('[PARSER ERROR] Invalid property:', params.property);
            return params;
        }

        // 3. Require "to" keyword
        if (args[i++]?.toLowerCase() !== 'to') {
            console.error('[PARSER ERROR] Missing "to" keyword');
            return params;
        }

        // 4. Parse new value (all tokens until next keyword)
        params.newValue = '';
        while (i < args.length && !['in', 'if'].includes(args[i]?.toLowerCase())) {
            params.newValue += args[i++] + ' ';
        }
        params.newValue = params.newValue.trim().replace(/^"|"$/g, '');

        // 5. Parse optional station filter
        if (i < args.length && args[i]?.toLowerCase() === 'in') {
            i += 2; // Skip "in stations"
            if (args[i++]?.toLowerCase() !== 'including') {
                console.error('[PARSER ERROR] Expected "including" after "in stations"');
                return params;
            }
            params.stationFilter = args[i++]?.replace(/^"|"$/g, '');
        }

        // 6. Parse optional condition
        if (i < args.length && args[i]?.toLowerCase() === 'if') {
            i++;
            params.condition = {
                property: args[i++]?.toLowerCase(),
                operator: args[i++]?.toLowerCase(),
                value: args.slice(i).join(' ').replace(/^"|"$/g, '')
            };
        }

        params.valid = true;
        console.log('[PARSER SUCCESS]', JSON.stringify(params, null, 2));
    } catch (error) {
        console.error('[PARSER CRASH]', error);
    }

    return params;
}
    
    /**
 * Processes batch edits with full path consistency and advanced condition handling
 * @param {Object} config - Station configuration object
 * @param {Object} params - Edit parameters
 * @returns {number} - Count of modified elements
 */
processBatchEdit(config, params) {
    console.log(`\n[START BATCH EDIT] ${config.station} ${config.line}`);
    console.log(`[PARAMS] ${JSON.stringify(params, null, 2)}`);

    // 1. Initialize tracking
    const changes = [];
    const pathUpdates = new Set();
    let modifiedCount = 0;

    // 2. Select target elements
    const elements = this.getTargetElements(config, params.target);
    console.log(`[TARGETS] Processing ${elements.length} ${params.target} elements`);

    // 3. Process each element
    elements.forEach((element, index) => {
        console.log(`\n[PROCESSING ${index + 1}/${elements.length}] ${element.id}`);
        
        // 3.1 Check conditions
        if (params.condition && !this.evaluateCondition(element, params.condition)) {
            console.log(`[SKIPPED] Condition not met`);
            return;
        }

        // 3.2 Apply primary edit
        const oldValue = element[params.property];
        element[params.property] = params.newValue;
        element.lastUpdated = new Date().toISOString();
        modifiedCount++;

        console.log(`[CHANGED] ${params.property}: ${oldValue} → ${params.newValue}`);
        changes.push({
            id: element.id,
            type: params.target.slice(0, -1), // Remove 's' (accesses → access)
            property: params.property,
            oldValue,
            newValue: params.newValue
        });

        // 3.3 Handle path dependencies if editing location-related fields
        if (this.isPathProperty(params.property)) {
            console.log(`[PATH EDIT] Detected location change, updating dependencies...`);
            const dependencies = this.updatePathDependencies(config, oldValue, params.newValue);
            dependencies.forEach(dep => pathUpdates.add(dep));
        }

        // 3.4 Record in change history
        config.changeHistory.push({
            timestamp: new Date().toISOString(),
            user: `${this.message.author.tag} (Batch)`,
            action: 'Edición avanzada',
            details: `${element.id}: ${params.property} cambiado de "${oldValue}" a "${params.newValue}"` +
                    (pathUpdates.size > 0 ? ` (+${pathUpdates.size} dependencias)` : '')
        });
    });

    // 4. Final updates
    if (modifiedCount > 0) {
        config.lastUpdated = new Date().toISOString();
        console.log(`\n[SUMMARY] Modified ${modifiedCount} elements with ${pathUpdates.size} path updates`);
        
        // Log all changes
        console.log(`[DIRECT CHANGES]`);
        changes.forEach(change => {
            console.log(`- ${change.type} ${change.id}: ${change.property} = ${change.newValue}`);
        });

        if (pathUpdates.size > 0) {
            console.log(`[PATH UPDATES]`);
            pathUpdates.forEach(update => console.log(`- ${update}`));
        }
    } else {
        console.log(`[SUMMARY] No elements modified`);
    }

    return modifiedCount;
}

// ======================
// SUPPORTING METHODS
// ======================

/**
 * Gets elements for editing based on target type
 */
getTargetElements(config, target) {
    switch (target) {
        case 'all':
            return [
                ...(config.accesses || []),
                ...(config.elevators || []),
                ...(config.escalators || [])
            ];
        default:
            return config[target] || [];
    }
}

/**
 * Evaluates conditions with full operator support
 */
evaluateCondition(element, condition) {
    const elementValue = String(element[condition.property] || '').toLowerCase();
    const conditionValue = condition.value.toLowerCase();
    
    // Special handling for line numbers (L1 vs 1)
    if (condition.property === 'line') {
        const normalize = val => val.replace(/^l/i, '');
        return this.compareValues(
            normalize(elementValue),
            normalize(conditionValue),
            condition.operator
        );
    }
    
    return this.compareValues(elementValue, conditionValue, condition.operator);
}

/**
 * Universal value comparison with all operators
 */
compareValues(a, b, operator) {
    switch (operator) {
        case '!': case 'not':       return a !== b;
        case '!==':                 return a !== b;
        case '===':                return a === b;
        case 'includes':           return a.includes(b);
        case 'startsWith':         return a.startsWith(b);
        case 'endsWith':           return a.endsWith(b);
        case 'matches':
            try { return new RegExp(b, 'i').test(a); } 
            catch { return false; }
        default: /* 'equals', '==' */ return a === b;
    }
}

/**
 * Checks if a property affects paths
 */
isPathProperty(property) {
    return ['from', 'to', 'fullPath'].includes(property);
}

/**
 * Updates all path references when locations change
 */
updatePathDependencies(config, oldValue, newValue) {
    const updatedElements = [];
    
    ['accesses', 'elevators', 'escalators'].forEach(type => {
        config[type]?.forEach(element => {
            let modified = false;
            
            // Update direct fields
            if (element.from === oldValue) {
                element.from = newValue;
                modified = true;
            }
            if (element.to === oldValue) {
                element.to = newValue;
                modified = true;
            }
            
            // Update full path
            if (element.fullPath?.includes(oldValue)) {
                element.fullPath = element.fullPath.replace(
                    new RegExp(`\\b${escapeRegExp(oldValue)}\\b`, 'g'),
                    newValue
                );
                modified = true;
            }
            
            // Update segments if they exist
            if (modified && Array.isArray(element.segments)) {
                element.segments = element.segments.map(seg => 
                    typeof seg === 'string'
                        ? seg.replace(new RegExp(`\\b${escapeRegExp(oldValue)}\\b`, 'g'), newValue)
                        : seg
                );
            }
            
            if (modified) {
                element.lastUpdated = new Date().toISOString();
                updatedElements.push(`${type.slice(0, -1)} ${element.id}`);
            }
        });
    });
    
    return updatedElements;
}

/**
 * Escapes strings for regex
 */
  escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
    
     
   
     
    
   
    chunkArray(array, size) {
        const chunks = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    }

    
}

module.exports = ConfigureHandler;