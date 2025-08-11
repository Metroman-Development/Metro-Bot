console.log('[BOOT] Starting bot initialization process...');
require('dotenv').config();
console.log('[CONFIG] Environment variables loaded');

// ======================
// DISCORD BOT INITIALIZATION
// ======================
console.log('[DISCORD] Loading Discord.js modules...');
const { Client, GatewayIntentBits, Collection, EmbedBuilder } = require('discord.js');
const { readdirSync } = require('fs');
const { join } = require('path');

console.log('[DISCORD] Loading internal modules...');
const logger = require('./events/logger');
const loadEvents = require('./events');
const NewsWatcher = require('./events/NewsWatcher');
const AdvancedCommandLoader = require('./core/loaders/AdvancedCommandLoader');
const { setClient } = require('./utils/clientManager');
const metroConfig = require('./config/metro/metroConfig');

console.log('[DISCORD] Creating Discord client instance...');
const discordClient = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

// ======================
// IMPROVED RECONNECTION SYSTEM
// ======================
const MAX_RETRIES = Infinity; // Keep retrying forever
const RETRY_DELAY = 60000; // 1 minute
let isShuttingDown = false;

async function connectToDiscord() {
  if (isShuttingDown) return;

  try {
    console.log('[DISCORD] Attempting to connect...');
    
    if (!process.env.DISCORD_TOKEN) {
      throw new Error('DISCORD_TOKEN is not defined in environment variables');
    }

    // Setup event listeners
    discordClient.removeAllListeners();
    
    discordClient.on('ready', () => {
      console.log(`✅ Discord bot ready as ${discordClient.user.tag}`);
      loadEvents(discordClient);
    });

    discordClient.on('disconnect', () => {
      console.warn('[DISCORD] Disconnected from Discord');
      scheduleReconnect();
    });

    discordClient.on('error', error => {
      console.error('[DISCORD] Error:', error);
    });

    discordClient.on('warn', warning => {
      console.warn('[DISCORD] Warning:', warning);
    });

    // Add login timeout
    const loginTimeout = 30000; // 30 seconds
    const loginPromise = discordClient.login(process.env.DISCORD_TOKEN);
    
    // Race between login and timeout
    await Promise.race([
      loginPromise,
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Login timeout')), loginTimeout)
      )
    ]);
    
    console.log('[DISCORD] Login successful');
  } catch (error) {
    console.error('[DISCORD] Connection failed:', error.message);
    scheduleReconnect();
  }
}

function scheduleReconnect() {
  if (isShuttingDown) return;

  console.log(`[DISCORD] Will attempt to reconnect in ${RETRY_DELAY/1000} seconds...`);
  setTimeout(() => {
    if (!discordClient.isReady() && !isShuttingDown) {
      connectToDiscord();
    }
  }, RETRY_DELAY);
}

// ======================
// BOT SETUP (UNCHANGED FUNCTIONALITY)
// ======================
discordClient.commands = new Collection();
discordClient.prefixCommands = new Collection();
discordClient.metroCore = require('./modules/metro/core/MetroCore');
discordClient.commandLoader = new AdvancedCommandLoader(discordClient);

// Load prefix commands
const prefixCommandsPath = join(__dirname, 'prefixCommands');
readdirSync(prefixCommandsPath)
  .filter(file => file.endsWith('.js'))
  .forEach(file => {
    const command = require(join(prefixCommandsPath, file));
    if ('name' in command && 'execute' in command) {
      discordClient.prefixCommands.set(command.name, command);
    }
  });

// Interaction handling
const { translateToTelegramEmoji, processForTelegram, translateUrgencyEmoji, getUrgencyColor, processLineKeywords } = require('./utils/messageFormatters');

setClient(discordClient);

// Message handling (unchanged)

// ======================
// TELEGRAM BOT INITIALIZATION
// ======================
console.log('[TELEGRAM] Loading Telegram bot module...');
const TelegramBot = require('./Telegram/bot');
const telegramBot = TelegramBot;

// ======================
// LAUNCH SEQUENCE
// ======================
console.log('[BOOT] Starting bot launch sequence...');
(async () => {
  try {
    

    // Start Telegram
    console.log('[TELEGRAM] Launching...');
    await telegramBot.launch()
       console.log('✅ Telegram bot ready')
      

    // Graceful shutdown
    console.log('[BOOT] Setting up shutdown handlers...');
    const shutdown = async (signal) => {
      isShuttingDown = true;
      console.log(`[SHUTDOWN] Received ${signal}, shutting down...`);
      try {
        if (discordClient.isReady()) {
          await discordClient.destroy();
          console.log('[DISCORD] Client destroyed');
        }
        await telegramBot.stop(signal);
        console.log('[TELEGRAM] Bot stopped');
        process.exit(0);
      } catch (err) {
        console.error('[SHUTDOWN] Error during shutdown:', err);
        process.exit(1);
      }
    };

    process.once('SIGINT', () => shutdown('SIGINT'));
    process.once('SIGTERM', () => shutdown('SIGTERM'));


    // Start Discord connection
    await connectToDiscord();
    
    console.log('[BOOT] All systems operational');
  } catch (error) {
    console.error('[BOOT] Initialization failed:', error);
  }
})();
