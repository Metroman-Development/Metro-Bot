const path = require('path');
const fs = require('fs').promises;
const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const TimeHelpers = require('../../chronos/timeHelpers');

class AccessCore {
    constructor() {
        this.permissions = [PermissionsBitField.Flags.Administrator];
    }

    async ensureAccessDetailsDir() {
        const dirPath = path.join(__dirname, '../../data/accessDetails');
        try {
            await fs.access(dirPath);
        } catch (error) {
            if (error.code === 'ENOENT') {
                await fs.mkdir(dirPath, { recursive: true });
                console.log('Created accessDetails directory');
            } else {
                throw error;
            }
        }
    }

    normalizeKey(str) {
        return str.toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '')
            .trim();
    }

    getConfigPath(stationKey) {
        const normalized = this.normalizeKey(stationKey);
        return path.join(__dirname, '../../data/accessDetails', `access_${normalized}.json`);
    }

    parseQuotedArgs(args) {
        const result = [];
        let currentPart = '';
        let inQuotes = false;
        
        for (const part of args) {
            if (part.startsWith('"') && !inQuotes) {
                inQuotes = true;
                currentPart = part.slice(1);
            } else if (part.endsWith('"') && inQuotes) {
                inQuotes = false;
                currentPart += ' ' + part.slice(0, -1);
                result.push(currentPart.trim());
                currentPart = '';
            } else if (inQuotes) {
                currentPart += ' ' + part;
            } else {
                result.push(part);
            }
        }

        if (inQuotes && currentPart) {
            result.push(currentPart.trim());
        }

        return result;
    }

    parsePath(pathStr) {
        if (!pathStr || typeof pathStr !== 'string') {
            throw new Error('Path cannot be empty');
        }

        const normalizedPath = pathStr.trim().replace(/,\s*$/, '');
        if (!normalizedPath) {
            throw new Error('Path cannot be empty');
        }

        const separators = ['→', '->', '-', '→'];
        let segments = [];
        let separatorUsed = null;

        for (const sep of separators) {
            if (normalizedPath.includes(sep)) {
                separatorUsed = sep;
                segments = normalizedPath.split(sep).map(s => s.trim()).filter(s => s);
                break;
            }
        }

        if (!separatorUsed) {
            return {
                from: normalizedPath,
                to: normalizedPath,
                fullPath: normalizedPath,
                segments: [normalizedPath]
            };
        }

        if (segments.length < 2) {
            throw new Error(`Invalid path format. Expected "From→To". Received: "${normalizedPath}"`);
        }

        return {
            from: segments[0],
            to: segments[segments.length - 1],
            fullPath: segments.join('→'),
            segments: segments
        };
    }

    parseKeyValueInput(input) {
        const lines = input.split('\n');
        const result = {};
        
        lines.forEach(line => {
            const [key, ...valueParts] = line.split(':');
            if (key && valueParts.length > 0) {
                result[key.trim().toLowerCase()] = valueParts.join(':').trim();
            }
        });

        return result;
    }

    async getAccessConfig(stationKey) {
        const configPath = this.getConfigPath(stationKey);
        try {
            const data = await fs.readFile(configPath, 'utf8');
            const config = JSON.parse(data);
            
            // Ensure all accesses have required fields
            config.accesses = config.accesses?.map(access => ({
                status: 'abierto',
                lastUpdated: TimeHelpers.currentTime.toISOString(),
                notes: '',
                ...access
            })) || [];
            
            // Ensure all elevators have required fields
            config.elevators = config.elevators?.map(elevator => ({
                status: 'operativa',
                lastUpdated: TimeHelpers.currentTime.toISOString(),
                notes: '',
                ...elevator
            })) || [];
            
            // Ensure all escalators have required fields
            config.escalators = config.escalators?.map(escalator => ({
                status: 'operativa',
                lastUpdated: TimeHelpers.currentTime.toISOString(),
                notes: '',
                ...escalator
            })) || [];

            // Ensure changeHistory exists
            config.changeHistory = config.changeHistory || [];
            
            return config;
        } catch (error) {
            if (error.code === 'ENOENT') {
                return null;
            }
            throw error;
        }
    }

    async saveAccessConfig(stationKey, config) {
        const configPath = this.getConfigPath(stationKey);
        await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf8');
    }

    sendSuccess(message, content) {
        return message.reply({
            embeds: [new EmbedBuilder()
                .setColor(0x00FF00)
                .setDescription(content)
            ]
        });
    }

    sendError(message, content) {
        return message.reply({
            embeds: [new EmbedBuilder()
                .setColor(0xFF0000)
                .setDescription(content)
            ]
        });
    }

 /*   renderConfigPreview(config) {
        let preview = "```\n";

        preview += "ACCESOS:\n";
        preview += config.accesses.map(a => 
            `• ${a.name} (ID: ${a.id})${a.description ? `\n  Descripción: ${a.description}` : ''}`
        ).join('\n');

        if (config.elevators.length > 0) {
            preview += "\n\nASCENSORES:\n";
            const elevatorsById = {};
            config.elevators.forEach(e => {
                if (!elevatorsById[e.id]) elevatorsById[e.id] = [];
                elevatorsById[e.id].push(e.fullPath || `${e.from} → ${e.to}`);
            });
            
            preview += Object.entries(elevatorsById).map(([id, paths]) => 
                `• ${id}: ${paths.join(', ')}`
            ).join('\n');
        }

        if (config.escalators.length > 0) {
            preview += "\n\nESCALERAS:\n";
            const escalatorsById = {};
            config.escalators.forEach(e => {
                if (!escalatorsById[e.id]) escalatorsById[e.id] = [];
                escalatorsById[e.id].push(`${e.from} → ${e.to}`);
            });
            
            preview += Object.entries(escalatorsById).map(([id, paths]) => 
                `• ${id}: ${paths.join(', ')}`
            ).join('\n');
        }

        return preview + "\n```";
    }*/
    

    async promptForConfirmation(message, promptText) {
        const prompt = await message.reply(promptText);
        const responses = await message.channel.awaitMessages({
            filter: m => m.author.id === message.author.id,
            max: 1,
            time: 120000,
            errors: ['time']
        });
        return responses.first().content;
    }

    async updateMainAccessibilityStatus(stationName, line, accessConfig) {
        try {
            const mainDataPath = path.join(__dirname, '../../data/stationsData.json');
            const rawData = await fs.readFile(mainDataPath, 'utf8');
            const data = JSON.parse(rawData);

            const stationKey = `${stationName.toLowerCase()} ${line.toLowerCase()}`;
            if (!data.stationsData[stationKey]) return;

            const outOfService = [
                ...accessConfig.elevators.filter(e => e.status.toLowerCase().includes('fuera de servicio')),
                ...accessConfig.escalators.filter(e => e.status.toLowerCase().includes('fuera de servicio'))
            ];

            let statusText = 'Todos los ascensores y escaleras mecánicas están operativos';
            if (outOfService.length > 0) {
                statusText = outOfService.map(item => 
                    `${item.id} (${item.from}→${item.to}): ${item.status}`
                ).join('\\n');
            }

            statusText += `\\n-# Última Actualización ${TimeHelpers.currentTime.format('DD-MM-YYYY HH:mm:ss')}`;

            data.stationsData[stationKey][2] = statusText;
            await fs.writeFile(mainDataPath, JSON.stringify(data, null, 2), 'utf8');
        } catch (error) {
            console.error('Error updating main stationsData:', error);
        }
    }

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

module.exports = AccessCore;
