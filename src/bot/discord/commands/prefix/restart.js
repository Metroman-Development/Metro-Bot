const BaseCommand = require('../BaseCommand');

class RestartCommand extends BaseCommand {
    constructor() {
        super({
            name: 'restart',
            description: 'Restarts the bot',
            permissions: ['ADMINISTRATOR'],
        });
    }

    async run(message) {
        if (!message.member.permissions.has('ADMINISTRATOR')) {
            return message.reply('You do not have permission to restart the bot.');
        }

        await message.reply('Restarting bot...');
        process.exit(0);
    }
}

module.exports = new RestartCommand();