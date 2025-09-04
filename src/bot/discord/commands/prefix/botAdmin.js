const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');
const BaseCommand = require('../BaseCommand');
const config = require('../../../config');

class BotAdminCommand extends BaseCommand {
    constructor() {
        super({
            name: 'botadmin',
            description: 'Administrative commands for managing the bot',
            usage: '!botadmin <subcommand> [arguments]',
        });
    }

    async run(message) {
        if (message.author.id !== config.ownerID) {
            return message.reply('You do not have permission to use this command.');
        }

        const args = message.content.slice(config.prefix.length).trim().split(/ +/);
        args.shift();

        if (args.length === 0) {
            return message.reply('Usage: !botadmin <subcommand> [arguments]');
        }

        const subcommand = args[0].toLowerCase();
        const subArgs = args.slice(1);

        switch (subcommand) {
            case 'addprefixcommand':
                return this.addPrefixCommand(message, subArgs);
            case 'addslashcommand':
                return this.addSlashCommand(message, subArgs);
            case 'remove':
                return this.removeCommand(message, subArgs);
            case 'reloadcommands':
                return this.reloadCommands(message);
            default:
                return message.reply(`Unknown subcommand: ${subcommand}`);
        }
    }

    async addPrefixCommand(message, args) {
        if (args.length < 2) {
            return message.reply('Usage: !botadmin addprefixcommand <commandName> <code>');
        }
        const commandName = args[0].toLowerCase();
        const code = args.slice(1).join(' ');
        if (!/^[a-z0-9]+$/i.test(commandName)) {
            return message.reply('The command name can only contain letters and numbers.');
        }
        if (!code.includes('run')) {
            return message.reply('The code must include a `run` function.');
        }
        const filePath = path.join(__dirname, `${commandName}.js`);
        const fileContent = `const BaseCommand = require('../BaseCommand');
module.exports = new (class extends BaseCommand {
    constructor() {
        super({ name: '${commandName}', description: 'A new prefix command.' });
    }
    async run(message) {
        ${code}
    }
})();`;
        fs.writeFileSync(filePath, fileContent);
        message.reply(`The prefix command '${commandName}' has been added/updated.`);
    }

    async addSlashCommand(message, args) {
        if (args.length < 2) {
            return message.reply('Usage: !botadmin addslashcommand <commandName> <code>');
        }
        const commandName = args[0].toLowerCase();
        const code = args.slice(1).join(' ');
        if (!/^[a-z0-9]+$/i.test(commandName)) {
            return message.reply('The command name can only contain letters and numbers.');
        }
        if (!code.includes('run')) {
            return message.reply('The code must include a `run` function.');
        }
        const filePath = path.join(__dirname, '..', 'slash', `${commandName}.js`);
        const fileContent = `const { SlashCommandBuilder } = require('discord.js');
const BaseCommand = require('../BaseCommand');
module.exports = new (class extends BaseCommand {
    constructor() {
        super(new SlashCommandBuilder().setName('${commandName}').setDescription('A new slash command.'));
    }
    async run(interaction) {
        ${code}
    }
})();`;
        fs.writeFileSync(filePath, fileContent);
        message.reply(`The slash command '${commandName}' has been added/updated.`);
    }

    async removeCommand(message, args) {
        if (args.length < 2) {
            return message.reply('Usage: !botadmin remove <prefix|slash> <commandName>');
        }
        const commandType = args[0].toLowerCase();
        const commandName = args[1].toLowerCase();
        if (commandType !== 'prefix' && commandType !== 'slash') {
            return message.reply('The command type must be "prefix" or "slash".');
        }
        if (!/^[a-z0-9]+$/i.test(commandName)) {
            return message.reply('The command name can only contain letters and numbers.');
        }
        const filePath = path.join(__dirname, '..', commandType, `${commandName}.js`);
        if (!fs.existsSync(filePath)) {
            return message.reply(`The command '${commandName}' does not exist.`);
        }
        fs.unlinkSync(filePath);
        message.reply(`The command '${commandName}' has been removed.`);
    }

    async reloadCommands(message) {
        const { client } = message;
        client.prefixCommands.clear();
        client.commands.clear();

        const prefixCommandFiles = fs.readdirSync(__dirname).filter(file => file.endsWith('.js'));
        for (const file of prefixCommandFiles) {
            delete require.cache[require.resolve(path.join(__dirname, file))];
            const command = require(path.join(__dirname, file));
            client.prefixCommands.set(command.data.name, command);
        }

        const slashDir = path.join(__dirname, '..', 'slash');
        const slashCommandFiles = fs.readdirSync(slashDir).filter(file => file.endsWith('.js'));
        for (const file of slashCommandFiles) {
            delete require.cache[require.resolve(path.join(slashDir, file))];
            const command = require(path.join(slashDir, file));
            client.commands.set(command.data.name, command);
        }

        const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
        const slashCommands = Array.from(client.commands.values()).map(cmd => cmd.data.toJSON());
        await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: slashCommands });
        message.reply('Commands have been reloaded, and slash commands have been registered globally.');
    }
}

module.exports = new BotAdminCommand();
        

    

            


                




                    
