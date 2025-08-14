require('dotenv').config();
const logger = require('./events/logger');
const TelegramBot = require('./bot/telegram/bot.js');

async function startTelegramBot() {
    logger.info('[TELEGRAM] Initializing...');
    try {
        TelegramBot.launch();
        logger.info('[TELEGRAM] ✅ Telegram bot launched successfully.');
    } catch (error) {
        logger.error('[TELEGRAM] ❌ Failed to launch Telegram bot:', { error });
        process.exit(1);
    }
}

startTelegramBot();

process.on('SIGINT', () => {
    logger.info('[TELEGRAM] Shutting down...');
    TelegramBot.stop('SIGINT');
    process.exit(0);
});
