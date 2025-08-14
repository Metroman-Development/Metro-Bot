require('dotenv').config();

const { Client, GatewayIntentBits, Collection } = require('discord.js');
const { readdirSync } = require('fs');
const { join } = require('path');
const loadEvents = require('./events');
const { setClient } = require('./utils/clientManager');
const AdvancedCommandLoader = require('./core/loaders/AdvancedCommandLoader');
const logger = require('./events/logger');
const DatabaseManager = require('./core/database/DatabaseManager');
const MetroCore = require('./core/metro/core/MetroCore');

async function startDiscordBot() {
    logger.info('[DISCORD] Initializing...');

    const dbConfig = {
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.METRODB_NAME,
    };
    await DatabaseManager.getInstance(dbConfig);

    let metroCore;
    try {
        metroCore = await MetroCore.getInstance();
        logger.info('[DISCORD] MetroCore initialized.');
    } catch (error) {
        logger.error('❌ Failed to initialize MetroCore:', { error });
        process.exit(1);
    }

    const discordClient = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent,
            GatewayIntentBits.GuildMembers,
        ],
    });

    discordClient.commands = new Collection();
    discordClient.prefixCommands = new Collection();
    discordClient.commandLoader = new AdvancedCommandLoader(discordClient);
    setClient(discordClient);

    const prefixCommandsPath = join(__dirname, 'bot/discord/commands/prefix');
    try {
        readdirSync(prefixCommandsPath)
            .filter(file => file.endsWith('.js'))
            .forEach(file => {
                const command = require(join(prefixCommandsPath, file));
                if ('name' in command && 'execute' in command) {
                    discordClient.prefixCommands.set(command.name, command);
                }
            });
        logger.info('[DISCORD] Prefix commands loaded.');
    } catch (error) {
        logger.error('[DISCORD] ❌ Failed to load prefix commands:', { error });
    }

    require('./events/interactions/interactionLoader')(discordClient);

    async function connectToDiscord(discordClient) {
        logger.info('[DISCORD] Attempting to connect to Discord...');
        if (!process.env.DISCORD_TOKEN) {
            throw new Error('DISCORD_TOKEN is not defined in environment variables. Please check your .env file.');
        }

        discordClient.removeAllListeners();
        discordClient.on('ready', () => {
            logger.info(`[DISCORD] ✅ Successfully connected as ${discordClient.user.tag}`);
            loadEvents(discordClient);
        });
        discordClient.on('disconnect', () => logger.warn('[DISCORD] ⚠️ Disconnected from Discord. Reconnecting is disabled.'));
        discordClient.on('error', error => logger.error('[DISCORD] ❌ An error occurred with the Discord client:', { error }));
        discordClient.on('warn', warning => logger.warn('[DISCORD] ⚠️ A warning was issued by the Discord client:', { warning }));

        const loginTimeout = 30000;
        const loginPromise = discordClient.login(process.env.DISCORD_TOKEN);
        await Promise.race([
            loginPromise,
            new Promise((_, reject) => setTimeout(() => reject(new Error('Login timed out after 30 seconds.')), loginTimeout)),
        ]);
        logger.info('[DISCORD] Login successful.');
    }

    try {
        await connectToDiscord(discordClient);
        metroCore.setClient(discordClient);

        const SchedulerService = require('./core/chronos/SchedulerService');
        const discordScheduler = new SchedulerService();
        discordScheduler.addJob({
            name: 'check-time',
            interval: 60000, // Every minute
            task: () => metroCore._subsystems.timeService.checkTime()
        });
        discordScheduler.start();

    } catch (error) {
        logger.warn(`[DISCORD] ⚠️ Could not connect to Discord: ${error.message}.`);
        // In a subprocess, we should exit if we can't connect to Discord
        process.exit(1);
    }
}

startDiscordBot();

process.on('SIGINT', () => {
    logger.info('[DISCORD] Shutting down...');
    // Add cleanup logic here if needed, e.g., discordClient.destroy()
    process.exit(0);
});
