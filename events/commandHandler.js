/*const fs = require('fs');
const path = require('path');
const { createEmbed } = require('../utils/embeds');
const config = require('../config/config.json');
const logger = require('./logger'); // Import the logger module

module.exports = {*/
    /**
     * Load commands dynamically, including commands in subfolders.
     * @param {Client} client - The Discord client.
     * @param {string} commandsDir - Directory containing commands.
     * @param {Collection} collection - Collection to store commands.
     * @param {string} type - Type of commands ('prefix' or 'slash').
     */
    /*loadCommands: (client, commandsDir, collection, type) => {
        const resolvedDir = path.join(__dirname, '..', commandsDir);
        logger.info(`Loading commands from: ${resolvedDir}`); // Use logger.info

        // Recursive function to load commands from subfolders
        const loadCommandsInFolder = (folderPath) => {
            const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));

            for (const file of commandFiles) {
                const commandPath = path.join(folderPath, file);
                let command;

                try {
                    command = require(commandPath);

                    // Validate the command object
                    if (!command || (!command.name && !command.data?.name)) {
                        logger.error(`❌ Invalid command file: ${commandPath}`);
                        continue; // Skip this file
                    }

                    // Set the command in the collection
                    collection.set(command.name || command.data.name, command);
                    logger.info(`✅ [${type}] Command loaded: ${command.name || command.data.name}`); // Use logger.info
                } catch (error) {
                    console.error(`❌ Error loading command from ${commandPath}:`, error);
                }
            }

            // Recursively load commands in subfolders
            const subfolders = fs.readdirSync(folderPath).filter(file => fs.lstatSync(path.join(folderPath, file)).isDirectory());
            for (const subfolder of subfolders) {
                loadCommandsInFolder(path.join(folderPath, subfolder));
            }
        };

        // Start loading commands from the base directory
        loadCommandsInFolder(resolvedDir);
    },

    /**
     * Reload a specific command.
     * @param {Client} client - The Discord client.
     * @param {string} commandsDir - Directory containing commands.
     * @param {Collection} collection - Collection to store commands.
     * @param {string} commandName - Name of the command to reload.
     */
 /*   reloadCommand: (client, commandsDir, collection, commandName) => {
        const resolvedDir = path.join(__dirname, commandsDir);
        logger.info(`Looking for command at: ${resolvedDir}`); // Use logger.info

        // Recursive function to find the command in subfolders
        const findCommandPath = (folderPath, commandName) => {
            const files = fs.readdirSync(folderPath);

            for (const file of files) {
                const filePath = path.join(folderPath, file);
                const stat = fs.lstatSync(filePath);

                if (stat.isDirectory()) {
                    const foundPath = findCommandPath(filePath, commandName);
                    if (foundPath) return foundPath;
                } else if (file === `${commandName}.js`) {
                    return filePath;
                }
            }

            return null;
        };

        const commandPath = findCommandPath(resolvedDir, commandName);

        if (!commandPath) {
            logger.error(`Command not found: ${commandName}`); // Use logger.error
            throw new Error(`Command not found: ${commandName}`);
        }

        // Delete the cached module
        delete require.cache[require.resolve(commandPath)];

        // Reload the command
        const command = require(commandPath);
        collection.set(command.name || command.data.name, command);
        logger.info(`✅ Command reloaded: ${command.name || command.data.name}`); // Use logger.info
    },

    /**
     * Unload a specific command.
     * @param {Collection} collection - Collection storing commands.
     * @param {string} commandName - Name of the command to unload.
     */
  /*  unloadCommand: (collection, commandName) => {
        if (!collection.has(commandName)) {
            logger.error(`Command not found: ${commandName}`); // Use logger.error
            throw new Error(`Command not found: ${commandName}`);
        }

        collection.delete(commandName);
        logger.info(`✅ Command unloaded: ${commandName}`); // Use logger.info
    },

    /**
     * Deactivate a command (mark as inactive without unloading).
     * @param {Collection} collection - Collection storing commands.
     * @param {string} commandName - Name of the command to deactivate.
     */
   /* deactivateCommand: (collection, commandName) => {
        if (!collection.has(commandName)) {
            logger.error(`Command not found: ${commandName}`); // Use logger.error
            throw new Error(`Command not found: ${commandName}`);
        }

        const command = collection.get(commandName);
        command.active = false; // Mark as inactive
        logger.info(`✅ Command deactivated: ${commandName}`); // Use logger.info
    },

    /**
     * Activate a command (mark as active).
     * @param {Collection} collection - Collection storing commands.
     * @param {string} commandName - Name of the command to activate.
     */
   /* activateCommand: (collection, commandName) => {
        if (!collection.has(commandName)) {
            logger.error(`Command not found: ${commandName}`); // Use logger.error
            throw new Error(`Command not found: ${commandName}`);
        }

        const command = collection.get(commandName);
        command.active = true; // Mark as active
        logger.info(`✅ Command activated: ${commandName}`); // Use logger.info
    },

    /**
     * Check if a user has permission to manage commands.
     * @param {Message} message - The message object.
     * @returns {boolean} - Whether the user has permission.
     */
 /*   hasPermission: (message) => {
        const isOwner = message.author.id === config.ownerID;
        const isAdmin = message.member.permissions.has('ADMINISTRATOR');
        return isOwner || isAdmin;
    }
};*/