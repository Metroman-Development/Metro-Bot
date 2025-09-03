const StatusUpdater = require('../../../../core/status/embeds/StatusUpdater');
const { MetroInfoProvider } = require('../../../../utils/MetroInfoProvider');
const ChangeDetector = require('../../../../core/status/ChangeDetector');
const ChangeAnnouncer = require('../../../../core/status/ChangeAnnouncer');
const metroConfig = require('../../../../config/metro/metroConfig');
const { getClient } = require('../../../../utils/clientManager');
const logger = require('../../../../events/logger');

module.exports = {
    name: 'updateembeds',
    description: '🔧 Manually update status embeds',
    permissions: ['ADMINISTRATOR'],
    usage: '!updateembeds <all|lineID> [--force]',

    async execute(message, args) {
        try {
            const client = getClient();
            if (!client) throw new Error('Discord client not available');

            // Initialize new components
            const metroInfoProvider = MetroInfoProvider.getInstance();
            if (!metroInfoProvider) {
                throw new Error('MetroInfoProvider is not initialized.');
            }
            const changeAnnouncer = new ChangeAnnouncer();
            const changeDetector = new ChangeDetector(changeAnnouncer);
            
            // Create StatusUpdater with all required dependencies
            const statusUpdater = new StatusUpdater(changeDetector, metroInfoProvider, changeAnnouncer);
            
            // Initialize components
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