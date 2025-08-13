const { EmbedBuilder } = require('discord.js');
const logger = require('../../../../events/logger');
const moment = require('moment-timezone');
const TimeHelpers = require('../../../../core/chronos/timeHelpers');
const util = require('util');
const { inspect } = require('util');

module.exports = {
    name: 'metrostatus',
    description: '🚇 Metro System Status Management',
    permissions: ['MANAGE_MESSAGES'],
    aliases: ['mstatus', 'metrosys', 'metrotest'],
    
    async execute(message, args) {
        try {
            const metroCore = await this.getMetroCoreSafe(message);
            const subcommand = args[0]?.toLowerCase() || 'overview';
            
            switch(subcommand) {
                case 'overview':
                    await this.handleOverview(message, metroCore);
                    break;
                    
                case 'lines':
                    await this.handleLines(message, metroCore, args[1]);
                    break;
                    
                case 'stations':
                    await this.handleStations(message, metroCore, args[1]);
                    break;
                    
                case 'schedule':
                    await this.handleSchedule(message, metroCore);
                    break;
                    
                case 'subsystems':
                    await this.handleSubsystems(message, metroCore);
                    break;
                    
                case 'test':
                    await this.handleChainTest(message, metroCore, args.slice(1));
                    break;
                    
                case 'epic':
                    await this.handleEpicTest(message, metroCore, args.slice(1));
                    break;
                    
                case 'help':
                    await this.showHelp(message);
                    break;
                    
                default:
                    await this.handleOverview(message, metroCore);
            }
        } catch (error) {
            await this.handleError(message, error);
        }
    },

    // Core Command Handlers
    async handleOverview(message, metroCore) {
        const data = await this.getSystemStatusSafe(metroCore);
        const helpers = await this.getScheduleHelpersSafe(metroCore);
        
        const embed = new EmbedBuilder()
            .setTitle('🚇 Metro System Overview')
            .setColor('#009688')
            .setDescription('Data from `metroCore.getSystemStatus()` and schedule helpers')
            .addFields(
                { 
                    name: 'Network Status', 
                    value: `\`${data.status}\`\n*(from network status API)*`,
                    inline: true 
                },
                { 
                    name: 'Operational Lines', 
                    value: `\`${data.lines.operational}/${data.lines.total}\`\n*(counted from line status codes)*`,
                    inline: true 
                },
                { 
                    name: 'Problem Stations', 
                    value: `\`${data.stations.total - data.stations.operational}\`\n*(status code ≠ 1)*`,
                    inline: true 
                },
                { 
                    name: 'Current Period', 
                    value: `\`${helpers?.getCurrentPeriod() || "Sin Información"}\`\n*(scheduleHelpers.getCurrentPeriod())*`,
                    inline: true 
                },
                { 
                    name: 'Express Active', 
                    value: `\`${(helpers?.shouldRunExpress() ? 'Yes' : 'No') || "Sin Información"}\`\n*(scheduleHelpers.shouldRunExpress())*`,
                    inline: true 
                },
                { 
                    name: 'Last Updated', 
                    value: `\`${moment(data.lastUpdated).fromNow()}\`\n*(from data.lastUpdated)*`,
                    inline: true 
                }
            );
            
        await this.sendEmbed(message, embed);
    },

    async handleLines(message, metroCore, lineId) {
        const lines = await this.getLinesSafe(metroCore);
        
        if(lineId) {
            const line = lines.find(l => l.id.toLowerCase() === lineId.toLowerCase());
            if(!line) throw new Error(`Line ${lineId} not found`);
            
            const embed = new EmbedBuilder()
                .setTitle(`🚇 Line ${lineId.toUpperCase()} Status`)
                .setColor(line.color || '#FFFFFF')
                .setDescription(`Data from \`metroCore.lines.get('${lineId}')\``)
                .addFields(
                    { 
                        name: 'Status', 
                        value: `\`${line.status.message}\`\n*(line.status object)*` 
                    },
                    { 
                        name: 'Stations', 
                        value: `\`${line.stations.length}\` stations\n*(line.stations array length)*` 
                    },
                    { 
                        name: 'Last Update', 
                        value: `\`${moment(line.lastUpdated).fromNow()}\`\n*(from line.lastUpdated)*` 
                    }
                );
                
            return this.sendEmbed(message, embed);
        }
        
        const embed = new EmbedBuilder()
            .setTitle('🚇 Line Status Overview')
            .setDescription(`Data from \`metroCore.lines.getAll()\`\n${lines.map(l => 
                `${l.color ? '⬛'.replace('#', l.color) : '▫️'} **Line ${l.id.toUpperCase()}** - \`${l.status.message}\``
            ).join('\n')}`);
            
        await this.sendEmbed(message, embed);
    },

    async handleStations(message, metroCore, filter) {
        const stations = await this.getStationsSafe(metroCore);
        const problematic = stations.filter(s => s.status.code !== '1');
        
        const embed = new EmbedBuilder()
            .setTitle('🚇 Station Status')
            .setColor('#FFA500')
            .setDescription(`Data from \`metroCore.stations.getAll()\`\n\`${problematic.length}\` stations reporting issues`);
            
        if(filter === 'full') {
            embed.addFields(
                problematic.map(s => ({
                    name: s.displayName,
                    value: `Line \`${s.line.toUpperCase()}\` - \`${s.status.message}\`\n*(Status code: ${s.status.code})*`,
                    inline: true
                }))
            );
        }
        
        await this.sendEmbed(message, embed);
    },

    async handleSchedule(message, metroCore) {
        const helpers = await this.getScheduleHelpersSafe(metroCore);
        const transitions = helpers.getUpcomingTransitions();
        
        const embed = new EmbedBuilder()
            .setTitle('⏰ Service Schedule')
            .setColor('#5865F2')
            .setDescription('Data from schedule helpers utility')
            .addFields(
                { 
                    name: 'Current Period', 
                    value: `\`${helpers.getCurrentPeriod()}\`\n*(getCurrentPeriod())*` 
                },
                { 
                    name: 'Next Transition', 
                    value: `\`${transitions[0]?.type || 'None'}\`\n*(getUpcomingTransitions()[0])*` 
                },
                { 
                    name: 'Scheduled At', 
                    value: `\`${transitions[0]?.time || 'N/A'}\`\n*(transition timestamp)*` 
                },
                { 
                    name: 'Express Windows', 
                    value: `\`${helpers.getNextExpressWindow()}\`\n*(getNextExpressWindow())*` 
                }
            );
            
        await this.sendEmbed(message, embed);
    },

    async handleSubsystems(message, metroCore) {
        const embed = new EmbedBuilder()
            .setTitle('⚙️ Subsystem Status')
            .setColor('#2ECC71')
            .setDescription('Direct subsystem health checks')
            .addFields(
                { 
                    name: 'API', 
                    value: metroCore._subsystems.api.lastData ? 
                        '✅ `Connected`\n*(api.lastData exists)*' : 
                        '❌ `Disconnected`\n*(no API data)*', 
                    inline: true 
                },
                { 
                    name: 'Database', 
                    value: metroCore._subsystems.dataLoader.ready ? 
                        '✅ `Ready`\n*(dataLoader.ready = true)*' : 
                        '🔄 `Loading`\n*(data not initialized)*', 
                    inline: true 
                },
                { 
                    name: 'Scheduler', 
                    value: metroCore.scheduler ? 
                        '✅ `Active`\n*(scheduler instance exists)*' : 
                        '❌ `Inactive`\n*(no scheduler)*', 
                    inline: true 
                },
                { 
                    name: 'Change Detection', 
                    value: `\`${metroCore._subsystems.changeDetector.consecutiveNoChangeCount}\` stable cycles\n*(changeDetector counter)*`, 
                    inline: true 
                }
            );
            
        await this.sendEmbed(message, embed);
    },

    // Chain Testing System
    async handleChainTest(message, metroCore, args) {
        const chain = args.join(' ');
        if (!chain) throw new Error('No chain provided');

        const result = await this.testPropertyChain(metroCore, chain);
        await this.sendChainResult(message, chain, result);
    },

    async testPropertyChain(root, chain) {
        const MAX_DEPTH = 5;
        const SAFE_TYPES = ['string', 'number', 'boolean', 'bigint', 'symbol', 'undefined'];
        const MAX_VALUE_LENGTH = 1000;
        
        try {
            const parts = chain.split('.').filter(p => p.trim());
            let current = root;
            let path = [];
            let parent = null;
            let accessChain = [];

            for (const part of parts) {
                parent = current;
                let accessedAs = 'property';
                
                if (current instanceof Map) {
                    current = current.get(part);
                    accessedAs = 'Map.get()';
                } else if (current instanceof Set) {
                    current = Array.from(current)[part];
                    accessedAs = 'Set[index]';
                } else if (Array.isArray(current)) {
                    if (/^\d+$/.test(part)) {
                        current = current[parseInt(part)];
                        accessedAs = 'array[index]';
                    } else {
                        current = current[part];
                    }
                } else {
                    current = current[part];
                }
                
                accessChain.push(`${part} (${accessedAs})`);
                
                if (typeof current === 'function') {
                    return {
                        exists: true,
                        type: 'function',
                        value: current.name,
                        protoChain: this.getPrototypeChain(parent),
                        accessChain: accessChain.join(' → ')
                    };
                }

                path.push(part);
                if (path.length > MAX_DEPTH) break;
            }

            let displayValue;
            if (current === null) {
                displayValue = 'null';
            } else if (SAFE_TYPES.includes(typeof current)) {
                displayValue = String(current);
            } else {
                displayValue = inspect(current, { 
                    depth: 1, 
                    breakLength: 80,
                    maxArrayLength: 3,
                    maxStringLength: 100
                });
            }

            return {
                exists: current !== undefined,
                type: typeof current,
                value: displayValue.slice(0, MAX_VALUE_LENGTH),
                protoChain: this.getPrototypeChain(parent),
                accessChain: accessChain.join(' → ')
            };
        } catch (error) {
            return {
                exists: false,
                error: error.message,
                stack: error.stack
            };
        }
    },

    // Epic Testing System
    async handleEpicTest(message, metroCore, args) {
        if (!args.length) throw new Error('No chain provided for epic test');
        
        const testCases = [
            { name: 'Basic Property', chain: args.join(' ') },
            { name: 'Function Exists', chain: args.join('.') + '.toString' },
            { name: 'Prototype Check', chain: args.join('.') + '.__proto__' },
            { name: 'Method Call', chain: args.join('.') + '()' }
        ];

        const results = [];
        for (const test of testCases) {
            results.push({
                name: test.name,
                result: await this.testPropertyChain(metroCore, test.chain)
            });
        }

        await this.sendEpicResults(message, args.join(' '), results);
    },

    // Utility Methods
    getPrototypeChain(obj) {
        if (!obj || typeof obj !== 'object') return 'No prototype';
        const chain = [];
        let current = obj;
        while (current = Object.getPrototypeOf(current)) {
            chain.push(current.constructor.name);
        }
        return chain.join(' → ') || 'No prototype chain';
    },

    async sendChainResult(message, chain, result) {
        const embed = new EmbedBuilder()
            .setTitle(`🔗 Chain Test: \`${chain}\``)
            .setColor(result.exists ? '#2ECC71' : '#E74C3C')
            .setDescription(result.exists ? 
                'Chain successfully resolved' : 
                'Chain resolution failed')
            .addFields({
                name: 'Existence',
                value: result.exists ? '✅ Valid chain' : '❌ Invalid chain',
                inline: true
            });

        if (result.exists) {
            embed.addFields(
                { name: 'Type', value: `\`${result.type}\``, inline: true },
                { name: 'Access Path', value: `\`${result.accessChain}\`` },
                { name: 'Value Preview', value: `\`\`\`js\n${result.value}\`\`\`` },
                { name: 'Prototype Chain', value: `\`${result.protoChain}\`` }
            );
        } else {
            embed.addFields(
                { name: 'Error', value: `\`\`\`${result.error}\`\`\`` },
                { name: 'Stack Trace', value: `\`\`\`${result.stack?.slice(0, 500) || 'No stack'}\`\`\`` }
            );
        }

        await this.sendEmbed(message, embed);
    },

    async sendEpicResults(message, originalChain, results) {
        const embed = new EmbedBuilder()
            .setTitle(`🧪 Epic Chain Test: \`${originalChain}\``)
            .setColor('#9B59B6')
            .setDescription('Comprehensive chain analysis results');

        for (const { name, result } of results) {
            const value = result.exists ? 
                `Type: \`${result.type}\`\n` + 
                (result.value ? `Value: \`\`\`js\n${result.value.slice(0, 150)}\`\`\`` : '') :
                `Error: \`${result.error?.slice(0, 100)}\``;

            embed.addFields({
                name: `${name}`,
                value: `${result.exists ? '✅' : '❌'} ${value}`,
                inline: true
            });
        }

        await this.sendEmbed(message, embed);
    },

    // Safety Wrappers
    async getMetroCoreSafe(message) {
        try {
            if (!message.client) throw new Error('Client not available');
            if (!message.client.metroCore) throw new Error('metroCore not initialized');
            
            return await Promise.race([
                message.client.metroCore.getInstance(),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('MetroCore init timeout')), 5000)
           )]);
        } catch (error) {
            logger.error('MetroCore access failed:', error);
            throw new Error('Failed to access MetroCore: ' + error.message);
        }
    },

    async getSystemStatusSafe(metroCore) {
        try {
            return await metroCore.getSystemStatus();
        } catch (error) {
            logger.warn('Fallback to cached system status');
            return metroCore._combinedData || {
                status: 'Unknown',
                lines: { total: 0, operational: 0 },
                stations: { total: 0, operational: 0 },
                lastUpdated: TimeHelpers.currentTime.toDate()
            };
        }
    },

    async getLinesSafe(metroCore) {
        try {
            return await metroCore.lines.getAll();
        } catch (error) {
            logger.warn('Fallback to basic lines data');
            return Object.values(metroCore._combinedData?.lines || {});
        }
    },

    async getStationsSafe(metroCore) {
        try {
            return await metroCore.stations.getAll();
        } catch (error) {
            logger.warn('Fallback to basic stations data');
            return Object.values(metroCore._combinedData?.stations || {});
        }
    },

    async getScheduleHelpersSafe(metroCore) {
        try {
            return metroCore._subsystems.utils.scheduleHelpers;
        } catch (error) {
            logger.warn('Fallback to basic schedule helpers');
            return {
                getCurrentPeriod: () => 'UNKNOWN',
                shouldRunExpress: () => false,
                getUpcomingTransitions: () => [],
                getNextExpressWindow: () => 'None'
            };
        }
    },

    // Core Utilities
    async sendEmbed(message, embed) {
        try {
            if (message.deletable) await message.delete().catch(() => {});
            await message.channel.sendTyping();
            
            embed.setFooter({ 
                text: `Metro System • ${TimeHelpers.currentTime.format('HH:mm:ss')}`,
                iconURL: 'https://cdn.discordapp.com/attachments/1326594661003034635/135259880988161842/logo_metro_versiones-04.jpg'
            });
            
            return await message.channel.send({ embeds: [embed] });
        } catch (error) {
            logger.error('Failed to send embed:', error);
            throw new Error('Failed to send response');
        }
    },

    async showHelp(message) {
        const embed = new EmbedBuilder()
            .setTitle('🚇 Metro Status Help')
            .setColor('#3498DB')
            .setDescription('Comprehensive system status monitoring')
            .addFields(
                { name: 'Main Commands', value: [
                    '`overview` - System summary',
                    '`lines [id]` - Line statuses',
                    '`stations [full]` - Problem stations',
                    '`schedule` - Service timetable',
                    '`subsystems` - Component health'
                ].join('\n') },
                { name: 'Debug Commands', value: [
                    '`test <chain>` - Test property chains',
                    '`epic <chain>` - Comprehensive chain analysis'
                ].join('\n') }
            );
            
        await this.sendEmbed(message, embed);
    },

    async handleError(message, error) {
        logger.error('Command failed:', {
            error: error.message,
            stack: error.stack,
            metadata: {
                guild: message.guild?.id,
                channel: message.channel?.id,
                user: message.author?.id
            }
        });

        try {
            await message.channel.send({
                embeds: [
                    new EmbedBuilder()
                        .setColor('#E74C3C')
                        .setTitle('❌ Command Error')
                        .setDescription(`\`\`\`diff\n- ${error.message}\n\`\`\``)
                        .setFooter({ text: `Error ID: ${Date.now()}` })
                ],
                content: message.author.toString()
            });
        } catch (sendError) {
            logger.error('Failed to send error message:', sendError);
        }
    }
};