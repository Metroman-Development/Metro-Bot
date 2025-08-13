require('dotenv').config();

const DatabaseManager = require('./core/database/DatabaseManager');
const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.METRODB_NAME,
};
DatabaseManager.getInstance(dbConfig);

console.log('███╗   ███╗███████╗████████╗██████╗  ██████╗  ██████╗ ');
console.log('████╗ ████║██╔════╝╚══██╔══╝██╔══██╗██╔═══██╗██╔═══██╗');
console.log('██╔████╔██║█████╗     ██║   ██████╔╝██║   ██║██║   ██║');
console.log('██║╚██╔╝██║██╔══╝     ██║   ██╔══██╗██║   ██║██║   ██║');
console.log('██║ ╚═╝ ██║███████╗   ██║   ██║  ██║╚██████╔╝╚██████╔╝');
console.log('╚═╝     ╚═╝╚══════╝   ╚═╝   ╚═╝  ╚═╝ ╚═════╝  ╚═════╝ ');

console.log('\n\n');
console.log('================================================================');
console.log('              Metrobot Bot - Initialization Process              ');
console.log('================================================================');


console.log('[CONFIG] Environment variables loaded.');


// =================================================================
//                      DISCORD BOT INITIALIZATION
// =================================================================
console.log('\n[DISCORD] Initializing Discord Bot...');
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

const discordClient = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});
console.log('[DISCORD] Discord client instance created.');

// Load external configuration
console.log('[CONFIG] Loading external configuration...');
if (process.env.KSON_CONFIG) {
  try {
    discordClient.config = JSON.parse(process.env.KSON_CONFIG);
    console.log('[CONFIG] Loaded configuration from KSON_CONFIG.');
  } catch (e) {
    console.error('[CONFIG] Failed to parse KSON_CONFIG:', e);
    discordClient.config = {};
  }
} else if (process.env.JSON_CONFIG) {
  try {
    discordClient.config = JSON.parse(process.env.JSON_CONFIG);
    console.log('[CONFIG] Loaded configuration from JSON_CONFIG.');
  } catch (e) {
    console.error('[CONFIG] Failed to parse JSON_CONFIG:', e);
    discordClient.config = {};
  }
} else {
  discordClient.config = {};
  console.log('[CONFIG] No external JSON/KSON configuration found. Running in "off-json" mode.');
}

// Load interaction handlers
console.log('[DISCORD] Loading interaction handlers...');
require('./events/interactions/interactionLoader')(discordClient);


// =================================================================
//                 IMPROVED RECONNECTION SYSTEM
// =================================================================
const MAX_RETRIES = Infinity;
const RETRY_DELAY = 60000; // 1 minute
let isShuttingDown = false;

async function connectToDiscord() {
  if (isShuttingDown) return;

  try {
    console.log('[DISCORD] Attempting to connect to Discord...');
    
    if (!process.env.DISCORD_TOKEN) {
      throw new Error('DISCORD_TOKEN is not defined in environment variables. Please check your .env file.');
    }

    // Setup event listeners
    discordClient.removeAllListeners();
    
    discordClient.on('ready', () => {
      console.log(`[DISCORD] ✅ Successfully connected as ${discordClient.user.tag}`);
      loadEvents(discordClient);
    });

    discordClient.on('disconnect', () => {
      console.warn('[DISCORD] ⚠️ Disconnected from Discord. Scheduling a reconnect attempt.');
      scheduleReconnect();
    });

    discordClient.on('error', error => {
      console.error('[DISCORD] ❌ An error occurred with the Discord client:', error);
    });

    discordClient.on('warn', warning => {
      console.warn('[DISCORD] ⚠️ A warning was issued by the Discord client:', warning);
    });

    // Add login timeout
    const loginTimeout = 30000; // 30 seconds
    const loginPromise = discordClient.login(process.env.DISCORD_TOKEN);
    
    await Promise.race([
      loginPromise,
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Login timed out after 30 seconds.')), loginTimeout)
      )
    ]);
    
    console.log('[DISCORD] Login successful.');
  } catch (error) {
    console.error(`[DISCORD] ❌ Connection failed: ${error.message}`);
    scheduleReconnect();
  }
}

function scheduleReconnect() {
  if (isShuttingDown) return;

  console.log(`[DISCORD] Retrying connection in ${RETRY_DELAY / 1000} seconds...`);
  setTimeout(() => {
    if (!discordClient.isReady() && !isShuttingDown) {
      connectToDiscord();
    }
  }, RETRY_DELAY);
}


// =================================================================
//                          BOT SETUP
// =================================================================
discordClient.commands = new Collection();
discordClient.prefixCommands = new Collection();
discordClient.metroCore = require('./core/metro/core/MetroCore');
discordClient.commandLoader = new AdvancedCommandLoader(discordClient);

// Load prefix commands
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
  console.log('[SETUP] Prefix commands loaded.');
} catch (error) {
  console.error('[SETUP] ❌ Failed to load prefix commands:', error);
}


const { translateToTelegramEmoji, processForTelegram, translateUrgencyEmoji, getUrgencyColor, processLineKeywords } = require('./utils/messageFormatters');

setClient(discordClient);

(async () => {
    try {
        const metro = await discordClient.metroCore.getInstance({ client: discordClient });
        console.log('[SETUP] MetroCore initialized for data export.');
    } catch (error) {
        console.error('❌ Failed to initialize MetroCore for data export:', error);
    }
})();


// =================================================================
//                   TELEGRAM BOT INITIALIZATION
// =================================================================
// console.log('\n[TELEGRAM] Initializing Telegram Bot...');
// const TelegramBot = require('./bot/telegram/bot');
// const telegramBot = TelegramBot;
// console.log('[TELEGRAM] Telegram bot module loaded.');


// =================================================================
//                         LAUNCH SEQUENCE
// =================================================================
console.log('\n[BOOT] Starting bot launch sequence...');
(async () => {
  try {
    // Start Telegram
    // console.log('[TELEGRAM] Launching Telegram bot...');
    // await telegramBot.launch();
    // console.log('[TELEGRAM] ✅ Telegram bot is now running.');
      
    // Graceful shutdown
    const shutdown = async (signal) => {
      isShuttingDown = true;
      console.log(`\n[SHUTDOWN] Received ${signal}. Gracefully shutting down...`);
      try {
        if (discordClient.isReady()) {
          await discordClient.destroy();
          console.log('[DISCORD] Client destroyed.');
        }
        // await telegramBot.stop(signal);
        // console.log('[TELEGRAM] Bot stopped.');
        console.log('[SHUTDOWN] ✅ Shutdown complete.');
        process.exit(0);
      } catch (err) {
        console.error('[SHUTDOWN] ❌ Error during shutdown:', err);
        process.exit(1);
      }
    };

    process.once('SIGINT', () => shutdown('SIGINT'));
    process.once('SIGTERM', () => shutdown('SIGTERM'));
    console.log('[BOOT] Shutdown handlers configured.');

    // Start Discord connection
    await connectToDiscord();
    
    console.log('\n[BOOT] ✅ All systems are operational.');
  } catch (error) {
    console.error('\n[BOOT] ❌ A critical error occurred during initialization:', error);
  }
})();
