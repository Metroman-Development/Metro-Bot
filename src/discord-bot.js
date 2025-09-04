const { initialize } = require('./core/bootstrap');
require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v10');
const { readdirSync } = require('fs');
const { join } = require('path');
const loadEvents = require('./events');
const { setClient } = require('./utils/clientManager');
const AdvancedCommandLoader = require('./core/loaders/AdvancedCommandLoader');
const logger = require('./events/logger');
const DatabaseManager = require('./core/database/DatabaseManager');
const metroConfig = require('./config/metro/metroConfig');

async function startDiscordBot() {
    const discordClient = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent,
            GatewayIntentBits.GuildMembers,
        ],
    });
    setClient(discordClient);

    const { metroInfoProvider, schedulerService } = await initialize('DISCORD');

    if (!metroInfoProvider.isInitialized) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for initialization
    }

    discordClient.commands = new Collection();
    discordClient.commandLoader = new AdvancedCommandLoader(discordClient);

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

        logger.info('[DISCORD] Registering slash commands...');
        const commandsToRegister = discordClient.commands.map(cmd => cmd.data.toJSON());
        const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

        try {
            await rest.put(
                Routes.applicationCommands(discordClient.user.id),
                { body: commandsToRegister },
            );
            logger.info('[DISCORD] ✅ Successfully registered slash commands.');
        } catch (error) {
            logger.error('[DISCORD] ❌ Failed to register slash commands:', error);
        }

        metroInfoProvider.statusEmbedManager.setClient(discordClient);

        const lineMessageIds = { ...metroConfig.embedMessageIds };
        delete lineMessageIds.overview;

        await metroInfoProvider.statusEmbedManager.initialize(
            metroConfig.embedsChannelId,
            metroConfig.embedMessageIds.overview,
            lineMessageIds
        );

        await metroInfoProvider.triggerInitialEmbedUpdate();

        process.on('message', async (message) => {
            const { type, payload } = message;
            if (type === 'send-message') {
                const { type: payloadType, channelId, message, link, photo } = payload;

                const channel = await discordClient.channels.fetch(channelId);
                if (!channel) {
                    logger.warn(`[DISCORD] Channel ${channelId} not found.`);
                    return;
                }

                if (payloadType === 'announcement') {
                    if (link || photo) {
                        const { EmbedBuilder } = require('discord.js');
                        const embed = new EmbedBuilder()
                            .setColor(0x0099FF)
                            .setDescription(message)
                            .setURL(link)
                            .setImage(photo);
                        await channel.send({ embeds: [embed] });
                    } else {
                        await channel.send(message);
                    }
                } else {
                    // Default behavior for other message types (e.g., network-info)
                    await channel.send(message);
                }
            }
        });

        const { updatePresence } = require('./modules/presence/presence.js');

        let lastEmbedUpdate = null;
        schedulerService.addJob({
            name: 'update-embeds',
            interval: 10000, // Every 10 seconds
            task: async () => {
                try {
                    const db = await DatabaseManager.getInstance();
                    const result = await db.query('SELECT last_updated FROM network_status WHERE id = 1');
                    if (result && result.length > 0) {
                        const lastUpdated = new Date(result[0].last_updated);
                        if (!lastEmbedUpdate || lastUpdated > lastEmbedUpdate) {
                            logger.info('[DISCORD] Detected change in network_status, updating embeds...');
                            if (metroInfoProvider.statusEmbedManager && typeof metroInfoProvider.statusEmbedManager.updateAllEmbeds === 'function') {
                                await metroInfoProvider.updateFromDb();
                                await metroInfoProvider.statusEmbedManager.updateAllEmbeds(metroInfoProvider);
                                lastEmbedUpdate = lastUpdated;
                            } else {
                                logger.warn('[DISCORD] statusEmbedManager or updateAllEmbeds method not available.');
                            }
                        }
                    }
                } catch (error) {
                    logger.error('[DISCORD] Error checking for embed updates:', error);
                }
            }
        });

        schedulerService.addJob({
            name: 'update-presence',
            interval: 60000, // Every minute
            task: async () => {
                if (discordClient.isReady()) {
                    await updatePresence(discordClient, metroInfoProvider);
                }
            }
        });

    } catch (error) {
        if (error.code === 'TokenInvalid') {
            logger.warn(`[DISCORD] ⚠️ Could not connect to Discord: ${error.message}. The bot will not be available on Discord, but other systems will continue to run.`);
        } else {
            logger.fatal(`[DISCORD] ⚠️ Could not connect to Discord: ${error.message}. Exiting...`, error);
            // In a subprocess, we should exit if we can't connect to Discord
            process.exit(1);
        }
    }
}

startDiscordBot();

process.on('SIGINT', () => {
    logger.info('[DISCORD] Shutting down...');
    // Add cleanup logic here if needed, e.g., discordClient.destroy()
    process.exit(0);
});
