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
        this.NAVIGATION_TIMEOUT = 120000; // 2 minutes
    }

    getNavigationInstructions() {
        if (this.currentSection === 'all') {
            return [
                '**Comandos de navegación:**',
                '`accesos` - Mostrar accesos',
                '`ascensores` - Mostrar ascensores',
                '`escaleras` - Mostrar escaleras',
                '`salir` - Finalizar navegación',
                '\n**Para editar:**',
                '`editar [tipo] [id]` - Editar un elemento específico',
                '`añadir [tipo]` - Añadir nuevo elemento',
                '`eliminar [tipo] [id]` - Eliminar elemento'
            ].join('\n');
        } else {
            return [
                '**Comandos de navegación:**',
                '`anterior` - Página anterior',
                '`siguiente` - Página siguiente',
                '`inicio` - Volver a vista general',
                '`salir` - Finalizar navegación',
                '\n**Para editar:**',
                '`editar [id]` - Editar este elemento',
                '`eliminar [id]` - Eliminar este elemento',
                '`añadir` - Añadir nuevo elemento'
            ].join('\n');
        }
    }

    async handle(message, args) {
    try {
        
        this.message
        // Clear any existing collectors to prevent memory leaks
        if (this.activeCollector) {
            this.activeCollector.stop();
            this.activeCollector = null;
        }

        // Handle advanced operations first
        if (args[0]?.toLowerCase() === 'aedit') {
            return this.batch.handleAdvancedEdit.call(this, message, args.slice(1));
        }
        
        if (args[0]?.toLowerCase() === 'replace') {
            return this.batch.handleReplaceOperation.call(this, message, args.slice(1));
        }

        // Parse quoted arguments (supports station names with spaces)
        const parsedArgs = this.parseQuotedArgs(args);
        const rawName = parsedArgs[0];
        const rawLine = parsedArgs[1];
        
        // Validate required arguments
        if (!rawName || !rawLine) {
            return this.sendError(message, 
                '❌ Debes especificar nombre de estación y línea\n' +
                'Ejemplo: `configurar "Plaza Egaña" L4`\n' +
                'O: `configurar Tobalaba L1`'
            );
        }

        // Ensure data directory exists
        await this.ensureAccessDetailsDir();

        // Create normalized keys
        this.stationKey = `${rawName} ${rawLine}`;
        this.normalizedKey = this.normalizeKey(this.stationKey);
        this.message = message;  // Store the message object for later use

        // Try to load existing config
        this.currentConfig = await this.getAccessConfig(this.normalizedKey);
        
        console.log(this.currentConfig)

        // Handle new station configuration
        if (!this.currentConfig) {
            this.currentConfig = this.createNewConfig(rawName, rawLine);
            await  this.saveAccessConfig(this.normalizedKey, this.currentConfig);
            
            // Send initial configuration prompt
            const promptEmbed = new EmbedBuilder()
                .setColor(0xFFFF00)
                .setTitle(`🆕 Nueva estación: ${this.stationKey}`)
                .setDescription([
                    'Esta estación no tiene configuración existente.',
                    '**Por favor provee los detalles iniciales:**',
                    '```',
                    'Accesos: Acceso A (Descripción: Ubicación), Acceso B',
                    'Ascensores: A: Calle→Boletería, Boletería→Andén',
                    'Escaleras: 1: Andén→Boletería, 2: Boletería→Calle',
                    '```',
                    'Escribe "cancelar" para abortar.'
                ].join('\n'));

            const promptMessage = await message.reply({ embeds: [promptEmbed] });
            return this.setupInitialConfigCollector(promptMessage);
        }

        // Reset view state for existing station
        this.currentPage = 0;
        this.currentSection = 'all';

        // Show appropriate view based on item count
        const totalItems = this.currentConfig.accesses.length + 
                         this.currentConfig.elevators.length + 
                         this.currentConfig.escalators.length;

        if (totalItems <= 10) {
            return this.showFullConfiguration();
        }
        return this.showPaginatedConfiguration();

    } catch (error) {
        console.error('Configuration Error:', error);
        
        // Clean up on error
        if (this.activeCollector) {
            this.activeCollector.stop();
            this.activeCollector = null;
        }

        return this.sendError(message, 
            `❌ Error crítico en configuración:\n` +
            `\`\`\`${error.message}\`\`\`\n` +
            `Por favor reporta este error al administrador.`
        );
    }
}
    
    createNewConfig(stationName, line) {
        return {
            station: stationName,
            line: line,
            accesses: [],
            elevators: [],
            escalators: [],
            changeHistory: [],
            lastUpdated: new Date().toISOString()
        };
    }

    

    async handleEditItem(message, item, itemType) {
        const embed = new EmbedBuilder()
            .setColor(0xFFFF00)
            .setTitle(`Editando ${item.id}`)
            .setDescription(`Actual: ${JSON.stringify(item, null, 2)}`)
            .addFields(
                { name: 'Comandos', value: 'Escribe los nuevos valores en formato JSON o "cancelar"' }
            );

        await this.message.reply({ embeds: [embed] });

        try {
            const responses = await message.channel.awaitMessages({
                filter: m => m.author.id === message.author.id,
                max: 1,
                time: 60000
            });

            const response = responses.first();
            if (response.content.toLowerCase() === 'cancelar') {
                await message.reply('Edición cancelada');
                return;
            }

            try {
                const updatedItem = JSON.parse(response.content);
                this.updateItemInConfig(item.id, updatedItem, itemType);
                await this.saveAccessConfig(this.normalizedKey, this.currentConfig);
                await message.reply('✅ Elemento actualizado correctamente');
            } catch (parseError) {
                await message.reply('❌ Formato inválido. Usa formato JSON válido');
            }
        } catch (error) {
            console.error('Error editing item:', error);
            await message.reply('❌ Error al editar el elemento');
        }
    }

    async handleAddItem(message, type) {
        const validTypes = ['acceso', 'ascensor', 'escalera'];
        const normalizedType = type.toLowerCase();
        
        if (!validTypes.includes(normalizedType)) {
            await message.reply(`❌ Tipo inválido. Usa: ${validTypes.join(', ')}`);
            return;
        }

        const example = this.getAddExample(normalizedType);
        const embed = new EmbedBuilder()
            .setColor(0xFFFF00)
            .setTitle(`Añadiendo nuevo ${type}`)
            .setDescription(`Proporciona los detalles en formato JSON\nEjemplo:\n\`\`\`json\n${example}\n\`\`\``)
            .addFields(
                { name: 'Comandos', value: 'Escribe los datos del nuevo elemento o "cancelar"' }
            );

        await message.reply({ embeds: [embed] });

        try {
            const responses = await message.channel.awaitMessages({
                filter: m => m.author.id === message.author.id,
                max: 1,
                time: 60000
            });

            const response = responses.first();
            if (response.content.toLowerCase() === 'cancelar') {
                await message.reply('Adición cancelada');
                return;
            }

            try {
                const newItem = JSON.parse(response.content);
                if (!newItem.id) {
                    await message.reply('❌ El elemento debe tener un campo "id"');
                    return;
                }
                
                this.addItemToConfig(normalizedType, newItem);
                await this.saveAccessConfig(this.normalizedKey, this.currentConfig);
                await message.reply(`✅ ${type} añadido correctamente`);
            } catch (parseError) {
                await message.reply('❌ Formato inválido. Usa formato JSON válido');
            }
        } catch (error) {
            console.error('Error adding item:', error);
            await message.reply('❌ Error al añadir el elemento');
        }
    }

    getAddExample(type) {
        switch (type) {
            case 'acceso':
                return JSON.stringify({
                    id: "A1",
                    name: "Acceso Norte",
                    description: "Ubicado en calle principal",
                    status: "abierto",
                    notes: ""
                }, null, 2);
            case 'ascensor':
                return JSON.stringify({
                    id: "E1",
                    from: "Andén",
                    to: "Boletería",
                    status: "operativo",
                    notes: ""
                }, null, 2);
            case 'escalera':
                return JSON.stringify({
                    id: "S1",
                    from: "Boletería",
                    to: "Calle",
                    status: "operativa",
                    notes: ""
                }, null, 2);
            default:
                return "";
        }
    }

    async handleDeleteItem(message, id, type) {
        const itemType = type || this.currentSection;
        const item = this.findItemById(id, itemType);
        if (!item) {
            await message.reply('❌ No se encontró el elemento con ese ID');
            return;
        }

        const embed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle(`Eliminar ${item.id}`)
            .setDescription(`¿Estás seguro de que quieres eliminar este elemento? (sí/no)\n\`\`\`json\n${JSON.stringify(item, null, 2)}\n\`\`\``);

        await message.reply({ embeds: [embed] });

        try {
            const responses = await message.channel.awaitMessages({
                filter: m => m.author.id === message.author.id,
                max: 1,
                time: 30000
            });

            const response = responses.first();
            if (response.content.toLowerCase() === 'sí' || response.content.toLowerCase() === 'si') {
                this.removeItemFromConfig(id, itemType);
                await this.saveAccessConfig(this.normalizedKey, this.currentConfig);
                await message.reply('✅ Elemento eliminado correctamente');
            } else {
                await message.reply('Eliminación cancelada');
            }
        } catch (error) {
            console.error('Error deleting item:', error);
            await message.reply('❌ Error al eliminar el elemento');
        }
    }

    findItemById(id, type = null) {
        
        let section = type;
        
        if (!section) {
          section= this.currentSection === 'all' ? 'accesses' : this.currentSection;
            }
            
        
        
        
        console.log("322",id)
        console.log("323",section)
        
        return this.currentConfig[section]?.find(item => item.id === id) ;
    }

    updateItemInConfig(id, updatedItem, type = null) {
        const section = type || this.currentSection === 'all' ? 'accesses' : this.currentSection;
        const index = this.currentConfig[section].findIndex(item => item.id === id);
        if (index !== -1) {
            this.currentConfig[section][index] = { ...this.currentConfig[section][index], ...updatedItem };
            this.currentConfig.lastUpdated = new Date().toISOString();
            this.recordChange('update', id, section);
        }
    }

    addItemToConfig(type, newItem) {
        const sectionMap = {
            'acceso': 'accesses',
            'ascensor': 'elevators',
            'escalera': 'escalators'
        };
        
        const section = sectionMap[type.toLowerCase()];
        if (section) {
            this.currentConfig[section].push(newItem);
            this.currentConfig.lastUpdated = new Date().toISOString();
            this.recordChange('add', newItem.id, section);
        }
    }

    removeItemFromConfig(id, type = null) {
        const section = type || this.currentSection === 'all' ? 'accesses' : this.currentSection;
        this.currentConfig[section] = this.currentConfig[section].filter(item => item.id !== id);
        this.currentConfig.lastUpdated = new Date().toISOString();
        this.recordChange('remove', id, section);
    }

    recordChange(action, itemId, section) {
        this.currentConfig.changeHistory.push({
            timestamp: new Date().toISOString(),
            user: this.message.author.tag,
            action: `${action}_${section}`,
            details: `Modified item ${itemId}`
        });
    }

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
                        value: `${this.currentConfig.accesses.length} registrados\nUsa \`accesos\` para ver`, 
                        inline: true 
                    },
                    { 
                        name: 'Ascensores', 
                        value: `${this.currentConfig.elevators.length} registrados\nUsa \`ascensores\` para ver`, 
                        inline: true 
                    },
                    { 
                        name: 'Escaleras', 
                        value: `${this.currentConfig.escalators.length} registradas\nUsa \`escaleras\` para ver`, 
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

    async showPaginatedConfiguration() {
    const embed = this.createPaginatedEmbed();
    const instructions = this.getNavigationInstructions();
    
    const sentMessage = await this.message.reply({ 
        content: instructions,
        embeds: [embed] 
    });

    await this.setupMessageCollector(sentMessage);
}

async showFullConfiguration() {
    const embed = new EmbedBuilder()
        .setColor(0x0099FF)
        .setTitle(`Configuración actual: ${this.stationKey}`)
        .addFields(
            // ... existing field definitions ...
        )
        .setFooter({ text: 'Responde con "editar [tipo] [id]" o "añadir [tipo]" o "cancelar"' });

    const sentMessage = await this.message.reply({ embeds: [embed] });
    await this.setupMessageCollector(sentMessage);
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
    
    async setupMessageCollector(sentMessage) {
    if (this.activeCollector) {
        this.activeCollector.stop();
    }

    const collector = this.message.channel.createMessageCollector({
        filter: m => m.author.id === this.message.author.id,
        time: this.NAVIGATION_TIMEOUT
    });

    this.activeCollector = collector;

    collector.on('collect', async (msg) => {
        try {
            const input = msg.content.toLowerCase().trim();
            
            // Immediate delete to keep chat clean
            await msg.delete().catch(() => {});

            // Handle cancellation first
            if (input === 'cancelar' || input === 'salir') {
                collector.stop();
                await sentMessage.edit({ 
                    content: '❌ Operación cancelada',
                    embeds: [] 
                });
                return;
            }

            // Unified command processing
            const response = await this.processCommand(input, msg);
            if (response.updateView) {
                const newEmbed = this.createPaginatedEmbed();
                await sentMessage.edit({
                    embeds: [newEmbed],
                    content: this.getNavigationInstructions()
                });
            }
        } catch (error) {
            console.error('Error processing command:', error);
            await this.message.reply({
                content: `❌ Error: ${error.message}`,
                deleteAfter: 5000
            }).catch(() => {});
        }
    });

    collector.on('end', () => {
        this.activeCollector = null;
    });
}
    
    // In your processCommand function, replace the error handling 
async processCommand(input, originalMessage) {
    const response = { updateView: false, shouldExit: false };
    const normalizedInput = input.toLowerCase().trim();
    
    try {
        // Navigation commands
        const navigationMap = {
            'accesos': 'accesses',
            'access': 'accesses',
            'a': 'accesses',
            'ascensores': 'elevators',
            'elevators': 'elevators',
            'e': 'elevators',
            'escaleras': 'escalators',
            'escalators': 'escalators',
            's': 'escalators',
            'inicio': 'all',
            'home': 'all',
            'h': 'all',
            'general': 'all',
            'g': 'all'
        };

        // Handle navigation commands
        if (navigationMap[normalizedInput]) {
            this.currentSection = navigationMap[normalizedInput];
            this.currentPage = 0;
            response.updateView = true;
            return response;
        }

        // Pagination commands
        if (['anterior', 'prev', 'p', 'atrás', 'back'].includes(normalizedInput)) {
            if (this.hasPreviousPage()) {
                this.currentPage--;
                response.updateView = true;
            } else {
                await originalMessage.reply({ 
                    content: '⚠️ Ya estás en la primera página', 
                    ephemeral: true 
                });
            }
            return response;
        }

        if (['siguiente', 'next', 'n', 'avanzar'].includes(normalizedInput)) {
            if (this.hasNextPage()) {
                this.currentPage++;
                response.updateView = true;
            } else {
                await originalMessage.reply({ 
                    content: '⚠️ Ya estás en la última página', 
                    ephemeral: true 
                });
            }
            return response;
        }

        // Edit command - enhanced version
        if (normalizedInput.startsWith('editar ') || normalizedInput.startsWith('edit ')) {
            const parts = originalMessage.content.split(/\s+/);
            
            // Determine type and ID based on current view
            let type, id;
            if (this.currentSection === 'all') {
                if (parts.length < 3) {
                    throw new Error('Formato: `editar [tipo] [id]` o `editar [id]` en vista detallada');
                }
                type = parts[1].toLowerCase();
                id = parts[2];
            } else {
                if (parts.length < 2) {
                    throw new Error('Formato: `editar [id]` en vista detallada');
                }
                type = this.currentSection;
                id = parts[1];
            }

            // Validate type
            const validTypes = ['accesses', 'elevators', 'escalators', 
                               'accesos', 'ascensores', 'escaleras',
                               'a', 'e', 's'];
            
            if (!validTypes.includes(type.toLowerCase())) {
                throw new Error(`Tipo inválido. Usa: ${validTypes.join(', ')}`);
            }

            // Normalize type to English
            if (type === 'accesos' || type === 'a') type = 'accesses';
            if (type === 'ascensores' || type === 'e') type = 'elevators';
            if (type === 'escaleras' || type === 's') type = 'escalators';

            const item = this.findItemById(id, type);
            if (!item) throw new Error(`No se encontró ${type.slice(0, -1)} con ID ${id}`);

            // Start interactive editing
            const success = await this.handleEditItem(originalMessage, item, type);
            if (success) {
                response.updateView = true;
            }
            return response;
        }

        // Add command
        if (normalizedInput.startsWith('añadir ') || normalizedInput.startsWith('add ')) {
            const parts = originalMessage.content.split(/\s+/);
            let type = parts[1]?.toLowerCase();
            
            // If in detailed view, use current section
            if (this.currentSection !== 'all' && parts.length === 1) {
                type = this.currentSection;
            }

            if (!type) {
                throw new Error('Formato: `añadir [tipo]` o `añadir` en vista detallada');
            }

            // Normalize type
            if (type === 'accesos' || type === 'a') type = 'accesses';
            if (type === 'ascensores' || type === 'e') type = 'elevators';
            if (type === 'escaleras' || type === 's') type = 'escalators';

            await this.handleAddItem(originalMessage, type);
            response.updateView = true;
            return response;
        }

        // Delete command
        if (normalizedInput.startsWith('eliminar ') || normalizedInput.startsWith('delete ')) {
            const parts = originalMessage.content.split(/\s+/);
            
            // Determine type and ID based on current view
            let type, id;
            if (this.currentSection === 'all') {
                if (parts.length < 3) {
                    throw new Error('Formato: `eliminar [tipo] [id]` o `eliminar [id]` en vista detallada');
                }
                type = parts[1].toLowerCase();
                id = parts[2];
            } else {
                if (parts.length < 2) {
                    throw new Error('Formato: `eliminar [id]` en vista detallada');
                }
                type = this.currentSection;
                id = parts[1];
            }

            // Normalize type
            if (type === 'accesos' || type === 'a') type = 'accesses';
            if (type === 'ascensores' || type === 'e') type = 'elevators';
            if (type === 'escaleras' || type === 's') type = 'escalators';

            await this.handleDeleteItem(originalMessage, id, type);
            response.updateView = true;
            return response;
        }

        // Help command
        if (normalizedInput === 'ayuda' || normalizedInput === 'help') {
            await originalMessage.reply({
                content: this.getNavigationInstructions(),
                ephemeral: true
            });
            return response;
        }

        // Cancel/exit command
        if (['cancelar', 'salir', 'exit', 'quit', 'done'].includes(normalizedInput)) {
            if (this.activeCollector) {
                this.activeCollector.stop();
                this.activeCollector = null;
            }
            response.shouldExit = true;
            await originalMessage.reply({ 
                content: '✅ Operación finalizada', 
                ephemeral: true 
            });
            return response;
        }

        // View current item (only in detailed view)
        if (normalizedInput === 'ver' && this.currentSection !== 'all') {
            const items = this.getCurrentPageItems();
            if (items.length > 0) {
                const embed = new EmbedBuilder()
                    .setTitle(`Elementos en página ${this.currentPage + 1}`)
                    .setDescription(items.map((item, i) => 
                        `${i + 1}. ${item.id} - ${item.name || `${item.from}→${item.to}`}`
                    ).join('\n'));
                
                await originalMessage.reply({ 
                    embeds: [embed],
                    ephemeral: true 
                });
            }
            return response;
        }

        // Unknown command - only show error if not in active interaction
        if (!this.isActiveInteraction()) {
            const suggestion = this.getCommandSuggestion(normalizedInput);
            throw new Error(suggestion || 'Comando no reconocido. Escribe `ayuda` para ver opciones.');
        }

        return response;

    } catch (error) {
        // Only show error if it's not part of an expected flow
        if (!this.isExpectedError(error)) {
            console.error('Command Processing Error:', error);
            
            const cleanMessage = this.cleanErrorMessage(error.message);
            await originalMessage.reply({
                content: `⚠️ ${cleanMessage}`,
                ephemeral: true
            }).catch(console.error);
        }
        return { updateView: false, shouldExit: false };
    }
}

// Helper Methods:

isActiveInteraction() {
    return !!this.activeCollector || this.currentSection !== 'all';
}

getCommandSuggestion(input) {
    const commandMap = {
        'listo': '¿Querías finalizar la edición? Usa `listo` solo durante edición interactiva.',
        '!stationaccess': 'El comando correcto es: `!accesos estación "Nombre Estación" Línea`',
        'ver todos': 'Para ver todo usa: `inicio` o `general`',
        'mostrar': 'Usa `ver` para detalles o `accesos`/`ascensores`/`escaleras` para secciones'
    };

    // Check for direct matches first
    if (commandMap[input]) {
        return commandMap[input];
    }

    // Check for partial matches
    for (const [wrongCmd, suggestion] of Object.entries(commandMap)) {
        if (input.includes(wrongCmd)) {
            return suggestion;
        }
    }

    return null;
}

cleanErrorMessage(msg) {
    // Remove redundant prefixes and format consistently
    return msg
        .replace(/^(error|❌|⚠️)\s*[:]\s*/i, '')
        .replace(/(\.|\!|\?)+$/, '') // Remove trailing punctuation
        .trim() + '.'; // Ensure single period at end
}

isExpectedError(error) {
    const expectedErrors = [
        'cancelar', 
        'salir',
        'timeout',
        'collector ended',
        'operation cancelled'
    ];
    return expectedErrors.some(e => error.message.toLowerCase().includes(e));
}

getCurrentPageItems() {
    switch (this.currentSection) {
        case 'accesses': 
            return this.currentConfig.accesses.slice(this.currentPage * 7, (this.currentPage + 1) * 7);
        case 'elevators':
            return this.currentConfig.elevators.slice(this.currentPage * 7, (this.currentPage + 1) * 7);
        case 'escalators':
            return this.currentConfig.escalators.slice(this.currentPage * 7, (this.currentPage + 1) * 7);
        default:
            return [];
    }
}
// Add these helper methods to your class:

    
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

    renderConfigPreview(config) {
        let preview = `**Estación:** ${config.station} ${config.line}\n\n`;
        
        preview += `**Accesos (${config.accesses.length}):**\n`;
        preview += config.accesses.slice(0, 3).map(a => `- ${a.name} (${a.id})`).join('\n');
        if (config.accesses.length > 3) preview += `\n...y ${config.accesses.length - 3} más`;
        
        preview += `\n\n**Ascensores (${config.elevators.length}):**\n`;
        preview += config.elevators.slice(0, 3).map(e => `- ${e.id}: ${e.from}→${e.to}`).join('\n');
        if (config.elevators.length > 3) preview += `\n...y ${config.elevators.length - 3} más`;
        
        preview += `\n\n**Escaleras (${config.escalators.length}):**\n`;
        preview += config.escalators.slice(0, 3).map(e => `- ${e.id}: ${e.from}→${e.to}`).join('\n');
        if (config.escalators.length > 3) preview += `\n...y ${config.escalators.length - 3} más`;
        
        return preview;
    }
    async promptForConfirmation(message, promptText) {
        const prompt = await message.reply(promptText);
        
        try {
            const responses = await message.channel.awaitMessages({
                filter: m => m.author.id === message.author.id,
                max: 1,
                time: 60000,
                errors: ['time']
            });
            
            return responses.first().content;
        } catch (error) {
            if (error.name === 'TimeoutError') {
                await message.reply('Tiempo agotado. Confirmación cancelada.');
            }
            return 'cancelar';
        }
    }

    // Static method to get legacy references
    static getLegacyReferences(instance) {
        return {
            handleAdvancedEdit: instance.batch.handleAdvancedEdit.bind(instance),
            handleReplaceOperation: instance.batch.handleReplaceOperation.bind(instance),
            parseAdvancedEditParams: instance.batch.parseAdvancedEditParams.bind(instance),
            processBatchEdit: instance.batch.processBatchEdit.bind(instance)
        };
    }
}

module.exports = {
    ConfigureHandler,
    getLegacyFunctions: () => {
        const instance = new ConfigureHandler();
        return ConfigureHandler.getLegacyReferences(instance);
    }
};