const { initialize } = require('./core/bootstrap');
const logger = require('./events/logger');
const TelegramBot = require('./bot/telegram/bot.js');

async function startTelegramBot() {
    logger.info('[TELEGRAM] Initializing...');
    await initialize('TELEGRAM');
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
