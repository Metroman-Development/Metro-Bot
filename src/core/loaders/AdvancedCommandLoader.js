const { readdirSync, statSync } = require('fs');
const { join } = require('path');
const { SlashCommandBuilder, PermissionFlagsBits, Collection } = require('discord.js');
const CacheManager = require('../cache/CacheManager');
const logger =require('../../events/logger');
const RoleSettingsManager = require('./RoleSettingsManager');
const config = { commandDefaults: {}, commands: {} };

class AdvancedCommandLoader {
    constructor(client) {
        this.client = client;
        this.roleSettings = new RoleSettingsManager();
        this.cache = CacheManager.getInstance();
        this.cooldowns = new Map();
        this.subcommandPaths = new Map(); // Track subcommand file paths
        this.loadCommands();
    }

    async loadCommands() {
        const basePath = join(__dirname, '../../bot/discord/commands/slash');
        let loadedCount = 0;
        let errorCount = 0;

        try {
            // Clear existing commands
            this.client.commands.clear();

            const categories = readdirSync(basePath);
            for (const category of categories) {
                const categoryPath = join(basePath, category);
                if (!statSync(categoryPath).isDirectory()) continue;

                const files = readdirSync(categoryPath);
                for (const file of files) {
                    if (!file.endsWith('.js')) continue;

                    try {
                        const filePath = join(categoryPath, file);
                        const command = require(filePath);
                        this.registerCommand(command, category, file, filePath);
                        loadedCount++;
                        logger.debug(`Successfully loaded command ${file}`);
                    } catch (error) {
                        errorCount++;
                        console.error(`Error loading ${category}/${file}:`, error);
                    }
                }
            }

            logger.info(`✅ Loaded ${loadedCount} commands (${errorCount} errors)`);
        } catch (error) {
            logger.error('Fatal error loading commands:', error);
            throw new Error('Failed to load commands: ' + error.message);
        }
    }

    registerCommand(command, category, filename, filePath) {
        try {
            // Validate command structure
            if (!command.data || !command.execute) {
                throw new Error('Invalid command structure - missing required properties');
            }

            // Apply base configuration
            command.category = category;
            command.config = this.getCommandConfig(command.data.name);
            command.cooldown = command.config.baseCooldown || 3;
            command.__filePath = filePath; // Store original file path

            // Handle subcommands
            if (filename.startsWith('_')) {
                const parentName = this.resolveParentName(filename, command);
                let parent = this.client.commands.get(parentName) || this.createParentCommand(parentName, category);
                
                // Register subcommand
                parent.data.addSubcommand(command.data);
                parent.subcommands = parent.subcommands || new Collection();
                parent.subcommands.set(command.data.name, command);
                
                // Store subcommand path for reloading
                this.subcommandPaths.set(`${parentName}:${command.data.name}`, filePath);
            } else {
                // Register main command
                this.client.commands.set(command.data.name, command);
            }
        } catch (error) {
            logger.error(`Error registering command ${filename}:`, error);
            throw error;
        }
    }

    async reloadSubcommand(parentName, subcommandName) {
        
        console.log("Recargando Subcomando ", parentName + subcommandName );
        
        
        
        console.log(this.client.commands.get(parentName).options) ;
        
        try {
            const parentCommand = this.client.commands.get(parentName);
            if (!parentCommand || !parentCommand.subcommands) {
                throw new Error(`Parent command ${parentName} not found or has no subcommands`);
            }

            const subcommand = parentCommand.subcommands.get(subcommandName.trim().toLowerCase() );
            if (!subcommand) {
                throw new Error(`Subcommand ${subcommandName} not found in ${parentName}`);
            }

            const filePath = this.subcommandPaths.get(`${parentName}:${subcommandName}`) || subcommand.__filePath;
            if (!filePath) {
                throw new Error('Subcommand file path not available for reloading');
            }

            // Clear cache and reload
            delete require.cache[require.resolve(filePath)];
            const newSubcommand = require(filePath);

            // Validate reloaded subcommand
            if (!newSubcommand.data || !newSubcommand.execute) {
                throw new Error('Reloaded subcommand has invalid structure');
            }

            // Update the subcommand
            parentCommand.subcommands.set(subcommandName, newSubcommand);
            
            // Update parent command's subcommand options
            parentCommand.data.options = parentCommand.data.options.filter(
                opt => opt.name !== subcommandName
            );
            parentCommand.data.addSubcommand(newSubcommand.data);

            // Store metadata
            newSubcommand.__filePath = filePath;
            newSubcommand.category = subcommand.category;
            newSubcommand.config = subcommand.config;
            newSubcommand.cooldown = subcommand.cooldown;

            logger.info(`Reloaded subcommand ${parentName}:${subcommandName}`);
            return newSubcommand;
        } catch (error) {
            logger.error(`Failed to reload subcommand ${parentName}:${subcommandName}:`, error);
            throw error;
        }
    }

    resolveParentName(filename, command) {
        return command.parentCommand || 
               filename.split('_')[1]?.replace('.js', '') || 
               'general';
    }

    createParentCommand(name, category) {
        const command = {
            data: new SlashCommandBuilder()
                .setName(name)
                .setDescription(`${name} commands`),
            category,
            subcommands: new Collection(),
            execute: async (interaction) => {
                const subcommandName = interaction.options.getSubcommand();
                const subcommandHandler = command.subcommands?.get(subcommandName);
                
                if (subcommandHandler) {
                    return this.handleExecution(interaction, subcommandHandler);
                }
                return interaction.reply({
                    content: '⚠️ Subcommand not found'
                });
            }
        };
        this.client.commands.set(name, command);
        return command;
    }

    async handleExecution(interaction, command) {
        try {
            // Check role-based availability
            const availability = await this.checkAvailability(interaction, command);
            if (!availability.allowed) {
                return interaction.reply({
                    content: availability.reason
                });
            }

            // Check cooldowns
            const cooldownMessage = await this.checkCooldown(interaction, command);
            if (cooldownMessage) {
                return interaction.reply({
                    content: cooldownMessage
                });
            }

            // Execute command
            await command.execute(interaction);
            this.logUsage(interaction, command);
        } catch (error) {
            logger.error(`Error executing ${command.data?.name || 'unknown'}:`, error);
            await interaction.reply({
                content: '❌ Error executing command'
            }).catch(() => {});
        }
    }

    async checkAvailability(interaction, command) {
        try {
            // Check global enable status
            if (command.config?.enabled === false) {
                return {
                    allowed: false,
                    reason: command.config.messages?.disabled || '⚠️ This command is temporarily disabled'
                };
            }

            const member = interaction.member;
            if (!member) return { allowed: false, reason: '⚠️ Member not found' };

            const settings = await this.roleSettings.getRoleSettings(member);
            if (settings.bypassRestrictions) {
                return { allowed: true };
            }

            // Check blacklisted roles
            if (command.config?.permissions?.blacklistedRoles?.some(roleId => 
                member.roles.cache.has(roleId))) {
                return {
                    allowed: false,
                    reason: command.config.messages?.noPermission || '❌ Your role cannot use this command'
                };
            }

            // Check required roles
            if (command.config?.permissions?.requiredRoles?.length > 0 && 
                !command.config.permissions.requiredRoles.some(roleId => 
                    member.roles.cache.has(roleId))) {
                return {
                    allowed: false,
                    reason: command.config.messages?.noPermission || '❌ You lack the required roles'
                };
            }

            return { allowed: true };
        } catch (error) {
            logger.error('Error checking command availability:', error);
            return {
                allowed: false,
                reason: '⚠️ Error checking permissions'
            };
        }
    }

    async checkCooldown(interaction, command) {
    try {
        if (!command || !command.data || !command.data.name) {
            logger.warn('Cooldown check skipped due to invalid command object.');
            return null;
        }

        const member = interaction.member;
        if (!member) return '⚠️ No se pudo identificar al miembro';

        const settings = await this.roleSettings.getRoleSettings(member);
        if (settings.ignoreCooldowns) return null;

        const cooldownKey = `${member.id}-${command.data.name}`;
        const now = Date.now();
        const timestamps = this.cooldowns.get(cooldownKey) || 0;
        
        // Check if guild is not the specific one (899841261740113980)
        const isTargetGuild = interaction.guild?.id === '899841261740113980';
        let cooldownAmount = await this.roleSettings.getEffectiveCooldown(
            member, 
            command.data.name,
            interaction.options.getSubcommand(false)
        ) * 1000;
        
        // If not the target guild, set cooldown to 1 second and add promotional message
        let promotionalMessage = '';
        if (!isTargetGuild) {
            cooldownAmount = 1000; // 1 second in milliseconds
            promotionalMessage = "\n\nÚnete al Servidor de Metro de Santiago para una experiencia sin restricciones";
        }

        if (now < timestamps) {
            const remaining = (timestamps - now) / 1000;
            return `⏳ Espera ${remaining.toFixed(1)} segundos antes de usar \`/${command.data.name}\` nuevamente.${promotionalMessage}`;
        }

        this.cooldowns.set(cooldownKey, now + cooldownAmount);
        setTimeout(() => this.cooldowns.delete(cooldownKey), cooldownAmount);
        return null;
    } catch (error) {
        logger.error('Error al verificar el tiempo de espera:', error);
        return '⚠️ Error al verificar el tiempo de espera';
    }
}

    getCommandConfig(commandName) {
        return {
            ...config.commandDefaults,
            ...(config.commands[commandName] || {})
        };
    }

    logUsage(interaction, command) {
        logger.info(`Command used: /${command.data.name} by ${interaction.user.tag}`, {
            guild: interaction.guild?.name,
            channel: interaction.channel?.name,
            options: interaction.options.data.map(opt => ({
                name: opt.name,
                value: opt.value
            }))
        });
    }
}

module.exports = AdvancedCommandLoader;
