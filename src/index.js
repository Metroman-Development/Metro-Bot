const { spawn } = require('child_process');
const path = require('path');
const logger = require('./events/logger');

const components = [
    { name: 'DiscordBot', path: './discord-bot.js' },
    { name: 'TelegramBot', path: './telegram-bot.js' },
    { name: 'Scheduler', path: './scheduler.js' },
];

function startComponent(component) {
    const componentPath = path.join(__dirname, component.path);
    const process = spawn('node', [componentPath], { stdio: 'inherit' });

    process.on('close', (code) => {
        logger.warn(`[${component.name}] child process exited with code ${code}. Restarting...`);
        startComponent(component);
    });

    process.on('error', (err) => {
        logger.error(`[${component.name}] error: ${err}`);
    });

    logger.info(`[${component.name}] starting...`);
}

components.forEach(startComponent);

process.on('SIGINT', () => {
    logger.info('Shutting down all components...');
    process.exit(0);
});
