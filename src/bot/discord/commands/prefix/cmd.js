const path = require('path');
const fs = require('fs');
const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const BaseCommand = require('../BaseCommand');
const config = require('../../../config');

class CmdCommand extends BaseCommand {
    constructor() {
        super({
            name: 'cmd',
            description: '⚙️ Advanced command management system',
            usage: 'm!cmd <action> <command> [type|value]\n' +
                'Actions: list, reload, activate, deactivate, cooldown, info\n' +
                'Subcommands: use parent:subcommand syntax (e.g. moderation:ban)',
            aliases: ['command', 'cmds'],
            category: 'admin',
            cooldown: 5,
            permissions: [PermissionsBitField.Flags.Administrator],
        });

        this.subcommands = new Map([
            ['list', this.handleList],
            ['reload', this.handleReload],
            ['activate', this.handleToggle.bind(this, true)],
            ['deactivate', this.handleToggle.bind(this, false)],
            ['cooldown', this.handleCooldown],
            ['info', this.handleInfo],
        ]);
    }

    async run(message) {
        if (!message.member.permissions.has(this.permissions)) {
            return this.sendError(message, 'You lack permissions to manage commands');
        }

        const args = message.content.slice(config.prefix.length).trim().split(/ +/);
        args.shift();

        const [action, commandName, ...extraArgs] = args;
        if (!action) return this.showHelp(message);

        const subcommand = this.subcommands.get(action.toLowerCase()) || this.showHelp;
        await subcommand.call(this, message, commandName, ...extraArgs);
    }

    async handleList(message, type = 'slash') {
        const collection = this.getCollection(message, type);
        if (!collection) return this.invalidType(message);

        const commands = [];
        for (const [name, cmd] of collection) {
            const status = this.getCommandStatus(cmd);
            const cooldown = cmd.data.cooldown ?? 'default';
            let entry = `- \`${name}\` ${status} (CD: ${cooldown}s)`;

            if (cmd.subcommands?.size > 0) {
                for (const [subName, subCmd] of cmd.subcommands) {
                    const subStatus = this.getCommandStatus(subCmd);
                    const subCooldown = subCmd.data.cooldown ?? 'inherit';
                    entry += `\n  ↳ \`${name}:${subName}\` ${subStatus} (CD: ${subCooldown}s)`;
                }
            }
            commands.push(entry);
        }

        return message.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor(0x0099FF)
                    .setTitle(`📋 ${this.capitalize(type)} Commands`)
                    .setDescription(commands.join('\n'))
                    .setFooter({ text: `Total: ${collection.size} commands` })
            ]
        });
    }

    async handleReload(message, commandName, type = 'slash') {
        if (!commandName) throw new Error('Specify a command to reload');

        if (commandName.includes(':')) {
            return this.handleSubcommandReload(message, commandName);
        }

        if (commandName.toLowerCase() === 'all') {
            return this.reloadAllCommands(message, type);
        }

        const collection = this.getCollection(message, type);
        if (!collection) return this.invalidType(message);

        const commandsDir = this.getCommandsDir(type);
        const commandFile = this.findCommandFile(commandsDir, commandName, type);
        if (!commandFile) throw new Error(`Command ${commandName} not found`);

        this.clearRequireCache(commandFile.path);
        const newCommand = require(commandFile.path);

        if (type === 'slash' && commandFile.path.includes('_')) {
            if (!message.client.commandLoader?.loadCommands) {
                throw new Error('Advanced command loader not available');
            }
            await message.client.commandLoader.loadCommands();
        } else {
            collection.set(newCommand.data.name, newCommand);
        }

        return this.sendSuccess(message, `Reloaded ${type} command \`${commandName}\``);
    }

    async handleSubcommandReload(message, fullCommandName) {
        const [parentName, subcommandName] = fullCommandName.split(':');
        if (!parentName || !subcommandName) {
            throw new Error('Use format: parent:subcommand');
        }
        if (!message.client.commandLoader?.reloadSubcommand) {
            throw new Error('Subcommand reloading not supported');
        }
        await message.client.commandLoader.reloadSubcommand(parentName, subcommandName);
        return this.sendSuccess(message, `Reloaded subcommand \`${fullCommandName}\``);
    }

    async handleToggle(activate, message, commandName, type = 'slash') {
        if (!commandName) throw new Error('Specify a command to toggle');

        if (commandName.includes(':')) {
            return this.handleSubcommandToggle(activate, message, commandName, type);
        }

        const collection = this.getCollection(message, type);
        if (!collection) return this.invalidType(message);

        const command = collection.get(commandName) ??
            Array.from(collection.values()).find(cmd =>
                cmd.data.aliases?.includes(commandName));

        if (!command) throw new Error(`Command ${commandName} not found`);

        command.data.active = activate;

        return this.sendSuccess(message,
            `${this.capitalize(type)} command \`${commandName}\` ${activate ? 'activated' : 'deactivated'}`
        );
    }

    async handleSubcommandToggle(activate, message, fullCommandName, type = 'slash') {
        const [parentName, subName] = fullCommandName.split(':');
        if (!parentName || !subName) throw new Error('Use format: parent:subcommand');

        const collection = this.getCollection(message, type);
        if (!collection) return this.invalidType(message);

        const parent = collection.get(parentName);
        if (!parent) throw new Error(`Parent command ${parentName} not found`);

        const subcommand = parent.subcommands?.get(subName);
        if (!subcommand) throw new Error(`Subcommand ${subName} not found`);

        subcommand.data.active = activate;

        return this.sendSuccess(message,
            `${this.capitalize(type)} subcommand \`${fullCommandName}\` ${activate ? 'activated' : 'deactivated'}`
        );
    }

    async handleCooldown(message, commandName, cooldownValue) {
        if (!commandName || !cooldownValue || isNaN(cooldownValue)) {
            throw new Error('Specify command and cooldown in seconds');
        }
        const cooldown = parseInt(cooldownValue);
        if (cooldown < 0 || cooldown > 3600) {
            throw new Error('Cooldown must be 0-3600 seconds');
        }

        if (commandName.includes(':')) {
            return this.handleSubcommandCooldown(message, commandName, cooldown);
        }

        const command = message.client.commands.get(commandName);
        if (!command) throw new Error(`Command ${commandName} not found`);

        command.data.cooldown = cooldown;

        return this.sendSuccess(message, `Cooldown for \`${commandName}\` set to ${cooldown}s`);
    }

    async handleSubcommandCooldown(message, fullCommandName, cooldown) {
        const [parentName, subName] = fullCommandName.split(':');
        if (!parentName || !subName) throw new Error('Use format: parent:subcommand');

        const parent = message.client.commands.get(parentName);
        if (!parent) throw new Error(`Parent command ${parentName} not found`);

        const subcommand = parent.subcommands?.get(subName);
        if (!subcommand) throw new Error(`Subcommand ${subName} not found`);

        subcommand.data.cooldown = cooldown;

        return this.sendSuccess(message, `Cooldown for \`${fullCommandName}\` set to ${cooldown}s`);
    }

    async handleInfo(message, commandName, type = 'slash') {
        if (!commandName) throw new Error('Specify a command to inspect');

        const collection = this.getCollection(message, type);
        if (!collection) return this.invalidType(message);

        const command = collection.get(commandName) ??
            Array.from(collection.values()).find(cmd =>
                cmd.data.aliases?.includes(commandName));

        if (!command) throw new Error(`Command ${commandName} not found`);

        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle(`ℹ️ Command Info: ${commandName}`)
            .addFields(
                { name: 'Category', value: command.data.category || 'None', inline: true },
                { name: 'Status', value: this.getCommandStatus(command), inline: true },
                { name: 'Cooldown', value: `${command.data.cooldown || 'default'}s`, inline: true }
            );

        if (command.data.description) {
            embed.setDescription(command.data.description);
        }
        if (command.data.aliases?.length > 0) {
            embed.addFields({ name: 'Aliases', value: command.data.aliases.join(', ') });
        }
        return message.reply({ embeds: [embed] });
    }

    getCollection(message, type) {
        if (!type) return null;
        type = type.toLowerCase();
        if (type === 'slash') return message.client.commands;
        if (type === 'prefix') return message.client.prefixCommands;
        return null;
    }

    getCommandsDir(type) {
        return type === 'slash'
            ? path.join(__dirname, '..', 'slash')
            : path.join(__dirname);
    }

    findCommandFile(baseDir, commandName, type) {
        try {
            if (type === 'slash') {
                const categories = fs.readdirSync(baseDir);
                for (const category of categories) {
                    const categoryPath = path.join(baseDir, category);
                    if (!fs.statSync(categoryPath).isDirectory()) continue;

                    const files = fs.readdirSync(categoryPath);
                    for (const file of files) {
                        if (!file.endsWith('.js')) continue;

                        const filePath = path.join(categoryPath, file);
                        try {
                            const cmd = require(filePath);
                            if ((cmd.data?.name === commandName) ||
                                (file.replace('.js', '') === commandName) ||
                                (cmd.data.name === commandName)) {
                                return { path: filePath, category };
                            }
                        } catch (e) {
                            continue;
                        }
                    }
                }
            } else {
                const files = fs.readdirSync(baseDir);
                for (const file of files) {
                    if (!file.endsWith('.js')) continue;
                    if (file.replace('.js', '') === commandName) {
                        return { path: path.join(baseDir, file) };
                    }
                }
            }
            return null;
        } catch (error) {
            console.error('[Find Command Error]', error);
            return null;
        }
    }

    clearRequireCache(filePath) {
        const resolvedPath = require.resolve(filePath);
        Object.keys(require.cache).forEach(key => {
            if (key === resolvedPath || key.startsWith(resolvedPath)) {
                delete require.cache[key];
            }
        });
    }

    getCommandStatus(command) {
        if (command.data.active === false) return '❌';
        return '✅';
    }

    async reloadAllCommands(message, type = 'slash') {
        const collection = this.getCollection(message, type);
        if (!collection) return this.invalidType(message);

        if (type === 'slash') {
            if (!message.client.commandLoader?.loadCommands) {
                throw new Error('Advanced command loader not available');
            }
            await message.client.commandLoader.loadCommands();
        } else {
            const commandsDir = this.getCommandsDir(type);
            if (!fs.existsSync(commandsDir)) {
                throw new Error(`Commands directory not found at ${commandsDir}`);
            }

            collection.clear();
            const commandFiles = fs.readdirSync(commandsDir)
                .filter(file => file.endsWith('.js'));

            for (const file of commandFiles) {
                const commandPath = path.join(commandsDir, file);
                this.clearRequireCache(commandPath);
                const command = require(commandPath);
                if (command.data.name) {
                    collection.set(command.data.name, command);
                }
            }
        }

        return this.sendSuccess(message, `Reloaded all ${type} commands (${collection.size} commands)`);
    }

    showHelp(message) {
        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('📚 Command Management Help')
            .setDescription(this.usage)
            .addFields(
                {
                    name: 'Examples', value:
                        '`m!cmd reload moderation:ban`\n' +
                        '`m!cmd deactivate music:play slash`\n' +
                        '`m!cmd cooldown ping 10`\n' +
                        '`m!cmd info help`'
                }
            );

        return message.reply({ embeds: [embed] });
    }

    sendSuccess(message, content) {
        return message.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setDescription(`✅ ${content}`)
            ]
        });
    }

    sendError(message, content) {
        return message.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setDescription(`❌ ${content}`)
            ]
        });
    }

    invalidType(message) {
        return this.sendError(message, 'Invalid type. Use "slash" or "prefix"');
    }

    capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
}

module.exports = new CmdCommand();