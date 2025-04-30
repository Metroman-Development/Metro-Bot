const logger = require('../events/logger'); // Import the custom logger

const queueSystem = {

    tasks: [],

    previousData: null,

    addTask: function (task) {

        logger.info(`Adding task for message ID: ${task.messageId} in channel ID: ${task.channelId}`);

        this.tasks.push(task); // Ensure `this` refers to the module

        this.processTasks();

    },

    storePreviousData: function (data) {

        logger.info('Storing previous data...');

        this.previousData = JSON.parse(JSON.stringify(data)); // Deep copy

    },

    getPreviousData: function () {

        return this.previousData;

    },

    processTasks: async function () {

        if (this.tasks.length === 0) {

            logger.info('No tasks to process.');

            return;

        }

        const task = this.tasks.shift();

        logger.info(`Processing task for message ID: ${task.messageId} in channel ID: ${task.channelId}`);

        try {

            // Fetch the channel

            const channel = await task.client.channels.fetch(task.channelId);

            if (!channel) {

                logger.error(`Channel not found for ID: ${task.channelId}`);

                return;

            }

            // Fetch the message

            const message = await channel.messages.fetch(task.messageId);

            if (!message) {

                logger.error(`Message not found for ID: ${task.messageId}`);

                return;

            }

            // Edit the message

            logger.info(`Editing message for Line ${task.messageId}...`);

            await message.edit({ embeds: [task.embed] });

            logger.info(`Successfully edited message for Line ${task.messageId}.`);

        } catch (error) {

            logger.error(`Error editing message for Line ${task.messageId}:`, error.message);

            if (error.code === 10008) { // Unknown Message (message was deleted)

                logger.error(`Message with ID ${task.messageId} was deleted. Skipping...`);

            } else if (error.code === 50013) { // Missing Permissions

                logger.error(`Bot lacks permissions to edit message in channel ${task.channelId}.`);

            } else if (error.code === 429) { // Rate Limited

                logger.error(`Rate limited. Retrying in ${error.retryAfter} seconds...`);

                setTimeout(() => this.processTasks(), error.retryAfter * 1000);

            } else {

                logger.error('Unknown error:', error);

            }

        }

        // Process the next task

        if (this.tasks.length > 0) {

            setTimeout(() => this.processTasks(), 1000); // Add a 1-second delay between tasks

        }

    },

};

// Bind methods to the queueSystem object

queueSystem.addTask = queueSystem.addTask.bind(queueSystem);

queueSystem.storePreviousData = queueSystem.storePreviousData.bind(queueSystem);

queueSystem.getPreviousData = queueSystem.getPreviousData.bind(queueSystem);

queueSystem.processTasks = queueSystem.processTasks.bind(queueSystem);

module.exports = queueSystem; 