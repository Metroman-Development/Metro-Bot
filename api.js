require('dotenv').config();

// Patch BigInt serialization
BigInt.prototype.toJSON = function() {
    return this.toString();
};

const path = require('path');
const fs = require('fs');
const { fork } = require('child_process');
const logger = require('./src/events/logger');
const DatabaseManager = require('./src/core/database/DatabaseManager');
const express = require('express');
const botRoutes = require('./src/utils/expressRoutes');

async function main() {
    console.log('[API] Initializing API server...');

    // Fork bot processes
    const bots = {};
    if (process.env.DISCORD_TOKEN) {
        const discordBotProcess = fork(path.join(__dirname, 'src', 'discord-bot.js'));
        bots['DiscordBot'] = discordBotProcess;
        logger.info('[API] Forked Discord bot process.');
    } else {
        logger.warn('[API] ⚠️ DISCORD_TOKEN not found. Discord bot will not be started.');
    }

    if (process.env.TELEGRAM_TOKEN) {
        const telegramBotProcess = fork(path.join(__dirname, 'src', 'telegram-bot.js'));
        bots['TelegramBot'] = telegramBotProcess;
        logger.info('[API] Forked Telegram bot process.');
    } else {
        logger.warn('[API] ⚠️ TELEGRAM_TOKEN not found. Telegram bot will not be started.');
    }

    let dbConfig;
    // Environment variables take precedence
    if (process.env.DB_HOST) {
        dbConfig = {
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.METRODB_NAME,
        };
    } else {
        // Fallback to config.json
        const configPath = path.join(__dirname, 'config.json');
        if (fs.existsSync(configPath)) {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            dbConfig = {
                host: config.DB_HOST,
                user: config.DB_USER,
                password: config.DB_PASSWORD,
                database: config.METRODB_NAME,
                port: config.DB_PORT
            };
        } else {
            logger.error(`[API] ❌ Database configuration not found. Please set environment variables or create config.json.`);
            process.exit(1);
        }
    }

    // Initialize DatabaseManager
    try {
        await DatabaseManager.getInstance(dbConfig, { componentName: 'API' });
        logger.info('[API] ✅ DatabaseManager initialized successfully.');
    } catch (error) {
        logger.error('[API] ❌ Failed to initialize DatabaseManager:', error);
        process.exit(1);
    }

    // Setup Express app
    const app = express();
    const port = process.env.API_PORT || 3000;
    const host = process.env.API_HOST || '0.0.0.0';

    // Middleware to handle JSON payloads
    app.use(express.json());

    // Function to send messages to forked bot processes
    const sendMessage = (target, payload) => {
        const botProcess = bots[target];
        if (botProcess && botProcess.connected) {
            botProcess.send({ type: 'send-message', payload });
            logger.info(`[API] Sent message to ${target}`);
        } else {
            logger.warn(`[API] ⚠️ ${target} is not running or not connected. This is expected if you are running without bot tokens.`);
        }
    };
    app.set('sendMessage', sendMessage);

    // Register routes
    app.use('/bot', botRoutes);

    // Start server
    app.listen(port, host, () => {
        logger.info(`[API] ✅ API server listening on http://${host}:${port}`);
    });

    // Handle bot process exit
    Object.values(bots).forEach(botProcess => {
        botProcess.on('exit', (code) => {
            logger.warn(`[API] Bot process exited with code ${code}.`);
        });
    });
}

main().catch(error => {
    logger.error('[API] ❌ Critical error during startup:', error);
    process.exit(1);
});
