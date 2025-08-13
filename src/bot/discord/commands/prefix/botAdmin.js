const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');

module.exports = {
    name: 'botadmin', // Command name
    description: 'Administrative commands for managing the bot',
    usage: '!botadmin <subcommand> [arguments]',
    async execute(message, args, client) {
        const allowedUserId = '1261050272906481808'; // Replace with the authorized user ID

        // Check user permission
        if (message.author.id !== allowedUserId) {
            return message.reply('You do not have permission to use this command.');
        }

        // Check if a subcommand is provided
        if (args.length === 0) {
            return message.reply('Usage: !botadmin <subcommand> [arguments]');
        }

        const subcommand = args[0].toLowerCase();

        // Handle each subcommand
        switch (subcommand) {
            case 'addprefixcommand': {
                if (args.length < 3) {
                    return message.reply('Usage: !botadmin addprefixcommand <commandName> <code>');
                }

                const commandName = args[1].toLowerCase();
                const code = args.slice(2).join(' ');

                // Validate command name
                if (!/^[a-z0-9]+$/i.test(commandName)) {
                    return message.reply('The command name can only contain letters and numbers.');
                }

                // Validate command code
                if (!code.includes('execute')) {
                    return message.reply('The code must include an `execute` function.');
                }

                // Path for the prefix command
                const filePath = path.join(__dirname, '..', 'commands', 'prefixCommands', `${commandName}.js`);
                const fileContent = `module.exports = {
    name: '${commandName}',
    execute(message, args) {
        ${code}
    }
};`;

                // Write to file
                try {
                    fs.writeFileSync(filePath, fileContent);
                    message.reply(`The prefix command '${commandName}' has been added/updated.`);
                } catch (error) {
                    console.error('Error writing the prefix command file:', error);
                    message.reply('There was an error adding/updating the prefix command.');
                }
                break;
            }

            case 'addslashcommand': {
                if (args.length < 3) {
                    return message.reply('Usage: !botadmin addslashcommand <commandName> <code>');
                }

                const commandName = args[1].toLowerCase();
                const code = args.slice(2).join(' ');

                // Validate command name
                if (!/^[a-z0-9]+$/i.test(commandName)) {
                    return message.reply('The command name can only contain letters and numbers.');
                }

                // Validate command code
                if (!code.includes('execute')) {
                    return message.reply('The code must include an `execute` function.');
                }

                // Path for the slash command
                const filePath = path.join(__dirname, '..', 'commands', 'slashCommands', `${commandName}.js`);
                const fileContent = `const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('${commandName}')
        .setDescription('Description for ${commandName}'),
    async execute(interaction) {
        ${code}
    }
};`;

                // Write to file
                try {
                    fs.writeFileSync(filePath, fileContent);
                    message.reply(`The slash command '${commandName}' has been added/updated.`);
                } catch (error) {
                    console.error('Error writing the slash command file:', error);
                    message.reply('There was an error adding/updating the slash command.');
                }
                break;
            }

            case 'remove': {
                // Validating arguments
                if (args.length < 3) {
                    return message.reply('Usage: !botadmin remove <prefix|slash> <commandName>');
                }

                const commandType = args[1].toLowerCase();
                const commandName = args[2].toLowerCase();

                // Validating command type
                if (commandType !== 'prefix' && commandType !== 'slash') {
                    return message.reply('The command type must be "prefix" or "slash".');
                }

                // Validating command name
                if (!/^[a-z0-9]+$/i.test(commandName)) {
                    return message.reply('The command name can only contain letters and numbers.');
                }

                // Check if the command exists
                const filePath = path.join(__dirname, '..', 'commands', `${commandType}Commands`, `${commandName}.js`);
                if (!fs.existsSync(filePath)) {
                    return message.reply(`The command '${commandName}' does not exist.`);
                }

                // Remove the command file
                try {
                    fs.unlinkSync(filePath);
                    message.reply(`The command '${commandName}' has been removed.`);
                } catch (error) {
                    console.error('Error removing the command file:', error);
                    message.reply('There was an error while removing the command.');
                }
                break;
            }

            case 'reloadcommands': {
                try {
                    // Clear existing commands
                    client.prefixCommands.clear();
                    client.commands.clear();

                    // Reload prefix commands
                    const prefixCommandFiles = fs.readdirSync(path.join(__dirname, '..', 'commands', 'prefixCommands'))
                        .filter(file => file.endsWith('.js'));
                    for (const file of prefixCommandFiles) {
                        delete require.cache[require.resolve(path.join(__dirname, '..', 'commands', 'prefixCommands', file))];
                        const command = require(path.join(__dirname, '..', 'commands', 'prefixCommands', file));
                        client.prefixCommands.set(command.name, command);
                    }

                    // Reload slash commands
                    const slashCommandFiles = fs.readdirSync(path.join(__dirname, '..', 'commands', 'slashCommands'))
                        .filter(file => file.endsWith('.js'));
                    for (const file of slashCommandFiles) {
                        delete require.cache[require.resolve(path.join(__dirname, '..', 'commands', 'slashCommands', file))];
                        const command = require(path.join(__dirname, '..', 'commands', 'slashCommands', file));
                        client.commands.set(command.data.name, command);
                    }

                    // Register slash commands globally
                    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
                    const slashCommands = Array.from(client.commands.values()).map(cmd => cmd.data.toJSON());

                    await rest.put(
                        Routes.applicationCommands(process.env.CLIENT_ID),
                        { body: slashCommands }
                    );
                    message.reply('Commands have been reloaded, and slash commands have been registered globally.');
                } catch (error) {
                    console.error('Error reloading commands:', error);
                    message.reply('There was an error while reloading the commands.');
                }
                break;
            }

            default: {
                message.reply(`Unknown subcommand: ${subcommand}`);
                break;
            }
        }
    },
};
        

    

            


                




                    
