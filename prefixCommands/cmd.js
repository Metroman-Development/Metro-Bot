const path = require('path');
const fs = require('fs');
const { EmbedBuilder, PermissionsBitField } = require('discord.js');

module.exports = {
    name: 'cmd',
    description: '⚙️ Advanced command management system',
    usage: 'm!cmd <action> <command> [type|value]\n' +
           'Actions: list, reload, activate, deactivate, cooldown, info\n' +
           'Subcommands: use parent:subcommand syntax (e.g. moderation:ban)',
    aliases: ['command', 'cmds'],
    category: 'admin',
    cooldown: 5,
    permissions: [PermissionsBitField.Flags.Administrator],

    async execute(message, args) {
        try {
            // Permission check
            if (!message.member.permissions.has(this.permissions)) {
                return this.sendError(message, 'You lack permissions to manage commands');
            }

            const [action, commandName, ...extraArgs] = args;
            if (!action) return this.showHelp(message);

            switch (action.toLowerCase()) {
                case 'list':
                    return this.handleList(message, extraArgs[0]);
                case 'reload':
                    return this.handleReload(message, commandName, extraArgs[0]);
                case 'activate':
                    return this.handleToggle(message, commandName, true, extraArgs[0]);
                case 'deactivate':
                    return this.handleToggle(message, commandName, false, extraArgs[0]);
                case 'cooldown':
                    return this.handleCooldown(message, commandName, extraArgs[0]);
                case 'info':
                    return this.handleInfo(message, commandName, extraArgs[0]);
                default:
                    return this.showHelp(message);
            }
        } catch (error) {
            console.error('[CMD Error]', error);
            return this.sendError(message, `Command Error: ${error.message}`);
        }
    },

    // === Command Handlers ===
    async handleList(message, type = 'slash') {
        try {
            const collection = this.getCollection(message, type);
            if (!collection) return this.invalidType(message);

            const commands = [];
            
            for (const [name, cmd] of collection) {
                const status = this.getCommandStatus(cmd);
                const cooldown = cmd.cooldown ?? cmd.config?.baseCooldown ?? 'default';
                let entry = `- \`${name}\` ${status} (CD: ${cooldown}s)`;

                // Add subcommands if they exist
                if (cmd.subcommands?.size > 0) {
                    for (const [subName, subCmd] of cmd.subcommands) {
                        const subStatus = this.getCommandStatus(subCmd);
                        const subCooldown = subCmd.cooldown ?? subCmd.config?.baseCooldown ?? 'inherit';
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
        } catch (error) {
            throw new Error(`Failed to list commands: ${error.message}`);
        }
    },

    async handleReload(message, commandName, type = 'slash') {
        try {
            if (!commandName) throw new Error('Specify a command to reload');

            // Handle subcommand reload
            if (commandName.includes(':')) {
                return this.handleSubcommandReload(message, commandName);
            }

            // Handle 'reload all'
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

            // Special handling for slash subcommands
            if (type === 'slash' && commandFile.path.includes('_')) {
                if (!message.client.commandLoader?.loadCommands) {
                    throw new Error('Advanced command loader not available');
                }
                await message.client.commandLoader.loadCommands();
            } else {
                collection.set(newCommand.name || newCommand.data?.name, newCommand);
            }

            return this.sendSuccess(message, `Reloaded ${type} command \`${commandName}\``);
        } catch (error) {
            throw new Error(`Reload failed: ${error.message}`);
        }
    },

    async handleSubcommandReload(message, fullCommandName) {
        try {
            const [parentName, subcommandName] = fullCommandName.split(':');
            if (!parentName || !subcommandName) {
                throw new Error('Use format: parent:subcommand');
            }

            if (!message.client.commandLoader?.reloadSubcommand) {
                throw new Error('Subcommand reloading not supported');
            }

            await message.client.commandLoader.reloadSubcommand(parentName, subcommandName);
            return this.sendSuccess(message, `Reloaded subcommand \`${fullCommandName}\``);
        } catch (error) {
            throw new Error(`Subcommand reload failed: ${error.message}`);
        }
    },

    async handleToggle(message, commandName, activate, type = 'slash') {
        try {
            if (!commandName) throw new Error('Specify a command to toggle');

            if (commandName.includes(':')) {
                return this.handleSubcommandToggle(message, commandName, activate, type);
            }

            const collection = this.getCollection(message, type);
            if (!collection) return this.invalidType(message);

            const command = collection.get(commandName) ?? 
                Array.from(collection.values()).find(cmd => 
                    cmd.aliases?.includes(commandName));

            if (!command) throw new Error(`Command ${commandName} not found`);

            // Update status
            if (type === 'slash') {
                command.config = command.config || {};
                command.config.enabled = activate;
            } else {
                command.active = activate;
            }

            return this.sendSuccess(message, 
                `${this.capitalize(type)} command \`${commandName}\` ${activate ? 'activated' : 'deactivated'}`
            );
        } catch (error) {
            throw new Error(`Toggle failed: ${error.message}`);
        }
    },

    async handleSubcommandToggle(message, fullCommandName, activate, type = 'slash') {
        try {
            const [parentName, subName] = fullCommandName.split(':');
            if (!parentName || !subName) throw new Error('Use format: parent:subcommand');

            const collection = this.getCollection(message, type);
            if (!collection) return this.invalidType(message);

            const parent = collection.get(parentName);
            if (!parent) throw new Error(`Parent command ${parentName} not found`);

            const subcommand = parent.subcommands?.get(subName);
            if (!subcommand) throw new Error(`Subcommand ${subName} not found`);

            if (type === 'slash') {
                subcommand.config = subcommand.config || {};
                subcommand.config.enabled = activate;
            } else {
                subcommand.active = activate;
            }

            return this.sendSuccess(message,
                `${this.capitalize(type)} subcommand \`${fullCommandName}\` ${activate ? 'activated' : 'deactivated'}`
            );
        } catch (error) {
            throw new Error(`Subcommand toggle failed: ${error.message}`);
        }
    },

    async handleCooldown(message, commandName, cooldownValue) {
        try {
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

            command.cooldown = cooldown;
            if (command.config) command.config.baseCooldown = cooldown;

            return this.sendSuccess(message, `Cooldown for \`${commandName}\` set to ${cooldown}s`);
        } catch (error) {
            throw new Error(`Cooldown set failed: ${error.message}`);
        }
    },

    async handleSubcommandCooldown(message, fullCommandName, cooldown) {
        try {
            const [parentName, subName] = fullCommandName.split(':');
            if (!parentName || !subName) throw new Error('Use format: parent:subcommand');

            const parent = message.client.commands.get(parentName);
            if (!parent) throw new Error(`Parent command ${parentName} not found`);

            const subcommand = parent.subcommands?.get(subName);
            if (!subcommand) throw new Error(`Subcommand ${subName} not found`);

            subcommand.cooldown = cooldown;
            if (subcommand.config) subcommand.config.baseCooldown = cooldown;

            return this.sendSuccess(message, `Cooldown for \`${fullCommandName}\` set to ${cooldown}s`);
        } catch (error) {
            throw new Error(`Subcommand cooldown failed: ${error.message}`);
        }
    },

    async handleInfo(message, commandName, type = 'slash') {
        try {
            if (!commandName) throw new Error('Specify a command to inspect');

            const collection = this.getCollection(message, type);
            if (!collection) return this.invalidType(message);

            const command = collection.get(commandName) ?? 
                Array.from(collection.values()).find(cmd => 
                    cmd.aliases?.includes(commandName));

            if (!command) throw new Error(`Command ${commandName} not found`);

            const embed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle(`ℹ️ Command Info: ${commandName}`)
                .addFields(
                    { name: 'Category', value: command.category || 'None', inline: true },
                    { name: 'Status', value: this.getCommandStatus(command), inline: true },
                    { name: 'Cooldown', value: `${command.cooldown || command.config?.baseCooldown || 'default'}s`, inline: true }
                );

            if (command.description) {
                embed.setDescription(command.description);
            }

            if (command.aliases?.length > 0) {
                embed.addFields({ name: 'Aliases', value: command.aliases.join(', ') });
            }

            if (command.config) {
                const configInfo = [];
                if (command.config.enabled !== undefined) {
                    configInfo.push(`Enabled: ${command.config.enabled}`);
                }
                if (command.config.permissions) {
                    if (command.config.permissions.requiredRoles?.length > 0) {
                        configInfo.push(`Required Roles: ${command.config.permissions.requiredRoles.length}`);
                    }
                    if (command.config.permissions.blacklistedRoles?.length > 0) {
                        configInfo.push(`Blacklisted Roles: ${command.config.permissions.blacklistedRoles.length}`);
                    }
                }
                if (configInfo.length > 0) {
                    embed.addFields({ name: 'Configuration', value: configInfo.join('\n') });
                }
            }

            return message.reply({ embeds: [embed] });
        } catch (error) {
            throw new Error(`Info failed: ${error.message}`);
        }
    },

    // === Helper Methods ===
    getCollection(message, type) {
        if (!type) return null;
        type = type.toLowerCase();
        if (type === 'slash') return message.client.commands;
        if (type === 'prefix') return message.client.prefixCommands;
        return null;
    },

    getCommandsDir(type) {
        return type === 'slash'
            ? path.join(__dirname, '../../slashCommands')
            : path.join(__dirname, '../../prefixCommands');
    },

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
                                (cmd.name === commandName)) {
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
    },

    clearRequireCache(filePath) {
        const resolvedPath = require.resolve(filePath);
        Object.keys(require.cache).forEach(key => {
            if (key === resolvedPath || key.startsWith(resolvedPath)) {
                delete require.cache[key];
            }
        });
    },

    getCommandStatus(command) {
        if (command.config?.enabled === false) return '❌';
        if (command.active === false) return '❌';
        return '✅';
    },

    async reloadAllCommands(message, type = 'slash') {
        try {
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
                    if (command.name) {
                        collection.set(command.name, command);
                    }
                }
            }

            return this.sendSuccess(message, `Reloaded all ${type} commands (${collection.size} commands)`);
        } catch (error) {
            throw new Error(`Reload all failed: ${error.message}`);
        }
    },

    // === UI Helpers ===
    showHelp(message) {
        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('📚 Command Management Help')
            .setDescription(this.usage)
            .addFields(
                { name: 'Examples', value: 
                    '`m!cmd reload moderation:ban`\n' +
                    '`m!cmd deactivate music:play slash`\n' +
                    '`m!cmd cooldown ping 10`\n' +
                    '`m!cmd info help`' 
                }
            );

        return message.reply({ embeds: [embed] });
    },

    sendSuccess(message, content) {
        return message.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setDescription(`✅ ${content}`)
            ]
        });
    },

    sendError(message, content) {
        return message.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setDescription(`❌ ${content}`)
            ]
        });
    },

    invalidType(message) {
        return this.sendError(message, 'Invalid type. Use "slash" or "prefix"');
    },

    capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
};