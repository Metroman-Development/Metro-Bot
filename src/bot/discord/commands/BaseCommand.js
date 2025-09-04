const { handleCommandError } = require('../../../utils/commandUtils');

class BaseCommand {
    constructor(data) {
        this.data = data;
        this.subcommands = new Map();
    }

    addSubcommand(subcommand) {
        this.subcommands.set(subcommand.data.name, subcommand);
        this.data.addSubcommand(subcommand.data);
    }

    async execute(interactionOrMessage) {
        try {
            if (interactionOrMessage.options && interactionOrMessage.options.getSubcommand(false)) {
                const subcommandName = interactionOrMessage.options.getSubcommand();
                const subcommand = this.subcommands.get(subcommandName);
                if (subcommand) {
                    await subcommand.execute(interactionOrMessage);
                } else {
                    // Subcommand not found, should not happen if registered correctly
                }
            } else {
                await this.run(interactionOrMessage);
            }
        } catch (error) {
            await handleCommandError(error, interactionOrMessage);
        }
    }

    async run(interactionOrMessage) {
        // This method is for commands without subcommands.
        // Or for the main command if it has its own logic besides subcommands.
        throw new Error('Subclasses must implement the "run" method if they are not a subcommand group.');
    }
}

module.exports = BaseCommand;
