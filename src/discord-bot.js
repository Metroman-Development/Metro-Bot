const { Client, GatewayIntentBits, Collection } = require('discord.js');
const { readdirSync } = require('fs');
const { join } = require('path');
const loadEvents = require('./events');
const { setClient } = require('./utils/clientManager');
const AdvancedCommandLoader = require('./core/loaders/AdvancedCommandLoader');
const logger = require('./events/logger');
const initialize = require('./core/bootstrap');
const DatabaseManager = require('./core/database/DatabaseManager');

async function startDiscordBot() {
    const { metroCore } = await initialize('DISCORD');

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

        // Initialize the command loader now that the database is ready
        discordClient.commandLoader = new AdvancedCommandLoader(discordClient);
        setClient(discordClient);

        const SchedulerService = require('./core/chronos/SchedulerService');
        const discordScheduler = new SchedulerService();

        let lastEmbedUpdate = null;
        discordScheduler.addJob({
            name: 'update-embeds',
            interval: 10000, // Every 10 seconds
            task: async () => {
                try {
                    const db = DatabaseManager.getInstance();
                    const result = await db.query('SELECT last_updated FROM network_status WHERE id = 1');
                    if (result && result.length > 0) {
                        const lastUpdated = new Date(result[0].last_updated);
                        if (!lastEmbedUpdate || lastUpdated > lastEmbedUpdate) {
                            logger.info('[DISCORD] Detected change in network_status, updating embeds...');
                            if (metroCore._subsystems.statusUpdater && typeof metroCore._subsystems.statusUpdater.updateEmbeds === 'function') {
                                await metroCore._subsystems.statusUpdater.updateEmbeds();
                            } else {
                                logger.warn('[DISCORD] statusUpdater or updateEmbeds method not available.');
                            }
                            lastEmbedUpdate = lastUpdated;
                        }
                    }
                } catch (error) {
                    logger.error('[DISCORD] Error checking for embed updates:', error);
                }
            }
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
