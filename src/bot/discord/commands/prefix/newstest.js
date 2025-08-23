const { EmbedBuilder } = require('discord.js');
const AnnouncementManager = require('../../../../core/status/embeds/AnnouncementManager');
const TimeHelpers = require('../../../../utils/timeHelpers');

module.exports = {
    name: 'newstest',
    description: '🚇 Test the metro announcement system',
    permissions: ['ADMINISTRATOR'],
    usage: '!newstest <type> <action> [details]',
    examples: [
        '!newstest express start L1 L3',
        '!newstest service open',
        '!newstest event end "Maintenance" EST1,EST2'
    ],
    
    async execute(message, args) {
        const embed = new EmbedBuilder().setColor('#0099ff');
        const manager = new AnnouncementManager(message.client);
        
        try {
            await manager.initialize();
            const subcommand = args[0]?.toLowerCase();
            
            switch(subcommand) {
                case 'express':
                    await this._handleExpressTest(message, manager, args.slice(1));
                    break;
                    
                case 'service':
                    await this._handleServiceTest(message, manager, args.slice(1));
                    break;
                    
                case 'event':
                    await this._handleEventTest(message, manager, args.slice(1));
                    break;
                    
                default:
                    await this._showHelp(message, embed);
            }
        } catch (error) {
            console.error('Announcement test failed:', error);
            await message.channel.send({ 
                embeds: [embed
                    .setColor('#FF0000')
                    .setDescription('❌ Error: ' + error.message)
                ] 
            });
        }
    },

    async _handleExpressTest(message, manager, args) {
        const action = args[0]?.toLowerCase() || 'start';
        const lines = args.slice(1).filter(arg => /^L\d+$/i.test(arg)) || ['L1', 'L2'];
        
        await manager.sendExpressUpdate({
            event: {
                action: action,
                period: `${TimeHelpers.formatTime(new Date())}-${TimeHelpers.formatTime(new Date(Date.now() + 2 * 60 * 60 * 1000))}`
            },
            timing: {
                remainingDuration: '2 horas'
            },
            context: {
                affectedLines: lines
            }
        });
        
        await message.reply(`✅ Express service ${action} test complete`);
    },

    async _handleServiceTest(message, manager, args) {
        const action = args[0]?.toLowerCase() || 'open';
        
        await manager.sendServiceChange({
            type: action === 'close' ? 'close' : 'open',
            dayType: TimeHelpers.currentDayType.toLowerCase(),
            systemState: {
                period: TimeHelpers.getCurrentPeriod().type,
                nextTransition: {
                    time: TimeHelpers.formatTime(new Date(Date.now() + 60 * 60 * 1000))
                }
            }
        });
        
        await message.reply(`✅ Service ${action} test complete`);
    },

    async _handleEventTest(message, manager, args) {
        const action = args[0]?.toLowerCase() || 'start';
        const eventName = args.slice(1).join(' ') || 'System Test';
        
        await manager.sendEventAnnouncement({
            event: {
                action: action,
                name: eventName
            },
            schedule: {
                start: TimeHelpers.formatTime(new Date()),
                end: TimeHelpers.formatTime(new Date(Date.now() + 2 * 60 * 60 * 1000)),
                remaining: 120
            },
            impact: {
                stations: ['EST1', 'EST2', 'EST3'],
                passengerEstimate: '5000'
            }
        });
        
        await message.reply(`✅ Event "${eventName}" ${action} test complete`);
    },

    async _showHelp(message, embed) {
        await message.channel.send({ 
            embeds: [embed
                .setTitle('🚇 Announcement Test Help')
                .addFields(
                    { 
                        name: 'Express Service', 
                        value: '`!newstest express <start/end> [L1 L2...]`\nExample: `!newstest express start L1 L3`' 
                    },
                    { 
                        name: 'Service Change', 
                        value: '`!newstest service <open/close>`\nExample: `!newstest service close`' 
                    },
                    { 
                        name: 'Special Event', 
                        value: '`!newstest event <start/end> [name]`\nExample: `!newstest event start "Maintenance"`' 
                    }
                )
                .setFooter({ text: `Current system time: ${TimeHelpers.formatDateTime(new Date())}` })
            ] 
        });
    }
};