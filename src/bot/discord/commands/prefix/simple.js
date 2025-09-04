const BaseCommand = require('../BaseCommand');

class SimpleCommand extends BaseCommand {
    constructor() {
        super({
            name: 'simple',
            description: 'A simple prefix command.',
        });
    }

    async run(message) {
        await message.channel.send('Pong!');
    }
}

module.exports = new SimpleCommand();
