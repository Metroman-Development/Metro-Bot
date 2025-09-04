const StatusUpdater = require('../../../../core/status/embeds/StatusUpdater');
const { MetroInfoProvider } = require('../../../../utils/MetroInfoProvider');
const ChangeDetector = require('../../../../core/status/ChangeDetector');
const ChangeAnnouncer = require('../../../../core/status/ChangeAnnouncer');
const metroConfig = require('../../../../config/metro/metroConfig');
const { getClient } = require('../../../../utils/clientManager');
const BaseCommand = require('../BaseCommand');
const config = require('../../../../config');

class UpdateEmbedsCommand extends BaseCommand {
    constructor() {
        super({
            name: 'updateembeds',
            description: '🔧 Manually update status embeds',
            permissions: ['ADMINISTRATOR'],
            usage: '!updateembeds <all|lineID> [--force]',
        });
    }

    async run(message) {
        const args = message.content.slice(config.prefix.length).trim().split(/ +/);
        args.shift();
        const client = getClient();
        if (!client) throw new Error('Discord client not available');

        const metroInfoProvider = MetroInfoProvider.getInstance();
        if (!metroInfoProvider) {
            throw new Error('MetroInfoProvider is not initialized.');
        }
        const changeAnnouncer = new ChangeAnnouncer();
        const changeDetector = new ChangeDetector(changeAnnouncer);
        const statusUpdater = new StatusUpdater(changeDetector, metroInfoProvider, changeAnnouncer);
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

        const lineId = target.toUpperCase().startsWith('L')
            ? target.toUpperCase()
            : `L${target.toUpperCase()}`;

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
    }
}

module.exports = new UpdateEmbedsCommand();