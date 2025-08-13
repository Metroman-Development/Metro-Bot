const path = require('path');
const fs = require('fs').promises;
const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const stationLoader = require('../modules/metro/data/loaders/stationLoader');
const loadJsonFile = require('../src/utils/jsonLoader');

module.exports = {
    name: 'stationsdata',
    description: '🚇 Gestiona los datos de las estaciones de metro',
    usage: 'm!stationsdata <acción> [estación] [línea] [clave] [valor]\n' +
           'Acciones: listar, ver, añadir, actualizar, eliminar, recargar\n' +
           'Ejemplos:\n' +
           'm!stationsdata listar\n' +
           'm!stationsdata ver "San Pablo" l1\n' +
           'm!stationsdata añadir "Nueva Estación" l1 transports "Bus, Taxi"\n' +
           'm!stationsdata actualizar "San Pablo" l5 image "new_url.png"\n' +
           'm!stationsdata eliminar "Estación Vieja" l2',
    aliases: ['sdata', 'stationdata'],
    category: 'admin',
    cooldown: 5,
    permissions: [PermissionsBitField.Flags.Administrator],

    async execute(message, args) {
        try {
            if (!message.member.permissions.has(this.permissions)) {
                return this.sendError(message, 'Necesitas permisos de administrador para gestionar datos de estaciones.');
            }

            const [action, ...restArgs] = args;
            if (!action) return this.showHelp(message);

            // Cargar datos actuales
            const rawData = loadJsonFile(path.join(__dirname, '../modules/metro/data/json/stationsData.json'));
            
            switch (action.toLowerCase()) {
                case 'listar':
                    return this.handleList(message, rawData);
                case 'ver':
                    return this.handleView(message, restArgs, rawData);
                case 'añadir':
                case 'agregar':
                    return this.handleAdd(message, restArgs, rawData);
                case 'actualizar':
                    return this.handleUpdate(message, restArgs, rawData);
                case 'eliminar':
                case 'remover':
                    return this.handleRemove(message, restArgs, rawData);
                case 'recargar':
                    return this.handleReload(message);
                default:
                    return this.showHelp(message);
            }
        } catch (error) {
            console.error('[Error en StationsData]', error);
            return this.sendError(message, `Operación fallida: ${error.message}`);
        }
    },

    // === Handlers ===
    async handleList(message, data) {
        const stations = Object.keys(data.stationsData);
        const schematics = Object.keys(data.stationsSchematics);

        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('📋 Lista de Estaciones')
            .addFields(
                { name: 'Datos Principales', value: stations.join('\n') || 'Ninguna', inline: true },
                { name: 'Esquemas', value: schematics.join('\n') || 'Ninguno', inline: true }
            )
            .setFooter({ text: `Total: ${stations.length} estaciones, ${schematics.length} esquemas` });

        return message.reply({ embeds: [embed] });
    },

    async handleView(message, args, data) {
        const [rawName, line] = args;
        if (!rawName) throw new Error('Especifica un nombre de estación');

        const stationKey = this.normalizeKey(`${rawName}`);
        const stationData = data.stationsData[stationKey] || data.stationsSchematics[stationKey];

        if (!stationData) throw new Error(`Estación "${stationKey}" no encontrada`);

        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle(`ℹ️ Datos de ${stationKey}`)
            .setDescription(`\`\`\`json\n${JSON.stringify(stationData, null, 2)}\`\`\``);

        await message.reply({ embeds: [embed] });
        return this.promptForMore(message);
    },

    async handleAdd(message, args, data) {
        const [rawName, line, key, ...valueParts] = args;
        if (!rawName || !line || !key) throw new Error('Faltan parámetros');
        
        const stationKey = this.normalizeKey(`${rawName}`);
        const value = valueParts.join(' ');

        if (data.stationsData[stationKey] || data.stationsSchematics[stationKey]) {
            throw new Error('La estación ya existe');
        }

        // Determinar si es un esquema
        const SCHEMATIC_KEYS = ['image', 'schematics'];
        const isSchematic = SCHEMATIC_KEYS.includes(key.toLowerCase());
        const target = isSchematic ? 'stationsSchematics' : 'stationsData';

        if (isSchematic) {
            data[target][stationKey] = value.split(/,\s*/);
        } else {
            data[target][stationKey] = Array(7).fill('None');
            const fieldMap = { transports:0, services:1, accessibility:2, commerce:3, amenities:4, image:5, commune:6 };
            const index = fieldMap[key.toLowerCase()];
            if (index === undefined) throw new Error(`Campo inválido: ${key}`);
            data[target][stationKey][index] = this.parseDataValue(value);
        }

        await this.saveData(data);
        await this.sendSuccess(message, `✅ Añadida "${stationKey}" a ${target}`);
        return this.promptForMore(message);
    },

    async handleUpdate(message, args, data) {
        const [rawName, line, key, ...valueParts] = args;
        if (!rawName || !line || !key) throw new Error('Faltan parámetros');
        
        const stationKey = this.normalizeKey(`${rawName}`);
        const value = valueParts.join(' ');

        // Determinar destino por clave
        const SCHEMATIC_KEYS = ['image', 'schematics'];
        const isSchematic = SCHEMATIC_KEYS.includes(key.toLowerCase());
        const target = isSchematic ? 'stationsSchematics' : 'stationsData';

        // Mapeo de campos
        const fieldMap = {
            transports: { index: 0, desc: "Transportes" },
            services: { index: 1, desc: "Servicios" },
            accessibility: { index: 2, desc: "Accesibilidad" },
            commerce: { index: 3, desc: "Comercios" },
            amenities: { index: 4, desc: "Amenidades" },
            image: { index: 5, desc: "Imagen" },
            commune: { index: 6, desc: "Comuna" }
        };

        // Verificar existencia
        if (!data[target][stationKey] && !data[isSchematic ? 'stationsData' : 'stationsSchematics'][stationKey]) {
            throw new Error(`Estación "${stationKey}" no encontrada`);
        }

        // Inicializar si no existe
        if (!data[target][stationKey]) {
            data[target][stationKey] = isSchematic ? [] : Array(7).fill('None');
        }

        // Actualizar
        if (isSchematic) {
            data[target][stationKey] = value.split(/,\s*/);
        } else {
            const field = fieldMap[key.toLowerCase()];
            if (!field) throw new Error(`Campo inválido: ${key}. Válidos: ${Object.keys(fieldMap).join(', ')}`);
            data[target][stationKey][field.index] = this.parseDataValue(value);
        }

        await this.saveData(data);
        const posInfo = isSchematic ? '' : `(posición ${fieldMap[key.toLowerCase()].index})`;
        await this.sendSuccess(message, `✅ Actualizado "${key}" en ${stationKey} ${posInfo}\nNuevo valor: ${value.slice(0, 50)}${value.length > 50 ? '...' : ''}`);
        return this.promptForMore(message);
    },

    async handleRemove(message, args, data) {
        const [rawName, line] = args;
        if (!rawName) throw new Error('Especifica un nombre de estación');
        
        const stationKey = this.normalizeKey(`${rawName} ${line}`);
        let target = 'stationsData';

        if (data.stationsSchematics[stationKey]) {
            target = 'stationsSchematics';
        } else if (!data.stationsData[stationKey]) {
            throw new Error(`Estación "${stationKey}" no encontrada`);
        }

        delete data[target][stationKey];
        await this.saveData(data);
        await this.sendSuccess(message, `✅ Eliminada "${stationKey}" de ${target}`);
        return this.promptForMore(message);
    },

    async handleReload(message) {
        delete require.cache[require.resolve('../json/stationsData.json')];
        await stationLoader.load();
        await this.sendSuccess(message, '✅ Datos recargados correctamente');
        return this.promptForMore(message);
    },

    // === New: Follow-up Prompt ===
    async promptForMore(message) {
        const prompt = await message.channel.send({
            embeds: [new EmbedBuilder()
                .setColor(0xFFFF00)
                .setDescription('¿Algo más? Responde con otro comando o "no".')
            ]
        });

        try {
            const response = await message.channel.awaitMessages({
                filter: m => m.author.id === message.author.id,
                max: 1,
                time: 30000,
                errors: ['time']
            });

            const content = response.first().content.toLowerCase();
            if (content === 'no' || content === 'nope') {
                await prompt.edit({
                    embeds: [new EmbedBuilder()
                        .setColor(0x00FF00)
                        .setDescription('✅ Operación completada.')
                    ]
                });
                return;
            }

            // Reprocess as new command
            const newArgs = content.split(/\s+/);
            await this.execute(message, newArgs);
        } catch {
            await prompt.edit({
                embeds: [new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setDescription('🕒 Tiempo de espera agotado.')
                ]
            });
        }
    },

    // === Helpers ===
    normalizeKey(str) {
        return str.toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, ' ')
            .replace(/"/g, '')
            .replace(/-/g, ' ')
            .trim();
    },

    parseDataValue(value) {
        try {
            return JSON.parse(value);
        } catch {
            return value;
        }
    },

    async saveData(data) {
    // First ensure all string values have literal \n instead of actual newlines
    const sanitizeStrings = (obj) => {
        if (typeof obj === 'string') {
            return obj.replace(/\r?\n/g, '\\n');
        }
        if (Array.isArray(obj)) {
            return obj.map(sanitizeStrings);
        }
        if (obj && typeof obj === 'object') {
            return Object.fromEntries(
                Object.entries(obj).map(([key, value]) => [key, sanitizeStrings(value)])
            );
        }
        return obj;
    };

    const sanitizedData = sanitizeStrings(data);

    // Then save with proper JSON formatting
    await fs.writeFile(
        path.join(__dirname, '../modules/metro/data/json/stationsData.json'),
        JSON.stringify(sanitizedData, null, 2), // null, 2 for pretty print
        'utf8'
    );
}, 
    
    // === UI Helpers ===
    showHelp(message) {
        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('🚇 Ayuda de Gestión de Estaciones')
            .setDescription(this.usage)
            .addFields(
                { name: 'Campos', value: 'transports, services, accessibility,\ncommerce, amenities, image, commune' },
                { name: 'Tipos', value: 'Texto, arrays (separados por comas),\no objetos JSON' }
            );

        return message.reply({ embeds: [embed] });
    },

    sendSuccess(message, content) {
        return message.reply({
            embeds: [new EmbedBuilder()
                .setColor(0x00FF00)
                .setDescription(content)
            ]
        });
    },

    sendError(message, content) {
        return message.reply({
            embeds: [new EmbedBuilder()
                .setColor(0xFF0000)
                .setDescription(`❌ ${content}`)
            ]
        });
    }
};