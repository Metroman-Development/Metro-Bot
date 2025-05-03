/*const { Events } = require('discord.js');
const logger = require('../logger');
const  config= require('../../config/config');

module.exports = {
    name: Events.MessageCreate,
    async execute(message, client) {
        try {
            // Ignore messages from bots or without prefix
            if (!message.content.startsWith(config.prefix)) return;
            
            const args = message.content.slice(config.prefix.length).trim().split(/ +/);
            const commandName = args.shift().toLowerCase();
            
            const command = client.commands.get(commandName) || 
                           client.commands.find(cmd => cmd.aliases && cmd.aliases.includes(commandName));
            
            if (!command) return;
            
            // Check if command is active
            if (command.active === false) {
                return message.reply('This command is currently disabled.');
            }
            
            // Check permissions
            if (command.permissions && !commandHandler.hasPermission(message)) {
                return message.reply('You do not have permission to use this command.');
            }
            
            // Execute command
            try {
                await command.execute(message, args, client);
                logger.info('COMMAND_EXECUTED', {
                    command: commandName,
                    user: message.author.tag,
                    guild: message.guild?.name || 'DM'
                });
            } catch (error) {
                logger.error('COMMAND_ERROR', {
                    command: commandName,
                    error: error.message,
                    stack: error.stack
                });
                message.reply('There was an error executing that command.');
            }
            
        } catch (error) {
            logger.error('COMMAND_HANDLER_ERROR', {
                error: error.message,
                stack: error.stack
            });
        }
    }
};*/