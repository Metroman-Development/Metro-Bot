const StatusUpdater = require('../modules/status/embeds/StatusUpdater'); // Adjust path as needed
//const  = require('./StatusUpdater'); // Adjust path as needed
const metroConfig = require('../config/metro/metroConfig');
const { getClient } = require('../utils/clientManager');
const metroCore = require('../modules/metro/core/MetroCore'); // Adjust path as needed
const logger = require('../events/logger');

                               
                              

module.exports = {
    name: 'updateembeds',
    description: '🔧 Manually update status embeds',
    permissions: ['ADMINISTRATOR'],
    usage: '!updateembeds <all|lineID> [--force]',
    
    async execute(message, args) {
        try {
            // Initialize all required components
            const client = getClient();
            if (!client) throw new Error('Discord client not available');
            
            const metro = await message.client.metroCore.getInstance({ 

                    client: client 

                });
            
            // console.log(metroCore)
            
            console.log(metro._subsystems) ;
            
            // Create ChangeDetector instance
            const changeDetector = metro._subsystems.changeDetector
       
           
            
            // Create StatusUpdater with all required dependencies
            const statusUpdater = new StatusUpdater({
                client: client,
                metroConfig: metroConfig,
                changeDetector: changeDetector,
                logger: logger
            });
            
            // Initialize components
            await changeDetector.initialize();
            await statusUpdater.initialize();
            
            const [target, ...flags] = args;
            const force = flags.includes('--force');
            
            if (!target || target.toLowerCase() === 'all') {
                await statusUpdater.forceUpdate({ 
                    line: 'all', 
                    priority: force 
                });
                return message.reply('✅ **All status embeds updated successfully!**');
            }
            
            // Handle line-specific update
            const lineId = target.toUpperCase().startsWith('L') 
                ? target.toUpperCase() 
                : `L${target.toUpperCase()}`;
                
            // Validate line exists
            if (!metroConfig.lines.includes(lineId)) {
                return message.reply([
                    `❌ Invalid line specified (${lineId})`,
                    `Available lines: ${metroConfig.lines.join(', ')}`,
                    `Example: \`!updateembeds L1\``
                ].join('\n'));
            }
            
            await statusUpdater.forceUpdate({ 
                line: lineId, 
                priority: force 
            });
            
            return message.reply(`✅ **${lineId} status embed updated successfully!**`);
            
        } catch (error) {
            console.error('Embed update failed', error);
            return message.reply([
                '❌ **Failed to update embeds**',
                `Error: ${error.message}`,
                `Usage: \`${this.usage}\``
            ].join('\n'));
        }
    }
};