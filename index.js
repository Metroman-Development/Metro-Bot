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

// Event loading
console.log('[DISCORD] Loading events...');
loadEvents(discordClient);
discordClient.on('debug', (info) => console.log(`[DISCORD DEBUG] ${info}`));

// Command collections
console.log('[DISCORD] Initializing command collections...');
discordClient.commands = new Collection();
discordClient.prefixCommands = new Collection();
discordClient.metroCore = require('./modules/metro/core/MetroCore');

// Command loader
console.log('[DISCORD] Initializing command loader...');
discordClient.commandLoader = new AdvancedCommandLoader(discordClient);

// Load prefix commands
console.log('[DISCORD] Loading prefix commands...');
const prefixCommandsPath = join(__dirname, 'prefixCommands');
try {
  const commandFiles = readdirSync(prefixCommandsPath).filter(file => file.endsWith('.js'));
  console.log(`[DISCORD] Found ${commandFiles.length} prefix command files`);
  
  commandFiles.forEach(file => {
    console.log(`[DISCORD] Loading prefix command: ${file}`);
    const command = require(join(prefixCommandsPath, file));
    if ('name' in command && 'execute' in command) {
      discordClient.prefixCommands.set(command.name, command);
      console.log(`[DISCORD] Registered prefix command: ${command.name}`);
    } else {
      console.warn(`[DISCORD] Invalid command structure in file: ${file}`);
    }
  });
} catch (error) {
  console.error('[DISCORD] Error loading prefix commands:', error);
}

// Interaction handling
console.log('[DISCORD] Setting up interaction handler...');
const interactionHandler = require('./modules/interactions/interactionHandler');
discordClient.on('interactionCreate', async interaction => {
  console.log(`[INTERACTION] Received interaction of type: ${interaction.type}`);
  
  try {
    if (interaction.isButton() || interaction.isAnySelectMenu() || interaction.isModalSubmit() || interaction.isContextMenuCommand()) {
      console.log(`[INTERACTION] Handling component interaction: ${interaction.customId || interaction.commandName}`);
      return interactionHandler.execute(interaction);
    }
    if (interaction.isCommand()) {
      console.log(`[INTERACTION] Handling slash command: ${interaction.commandName}`);
      const command = discordClient.commands.get(interaction.commandName);
      if (!command) {
        console.warn(`[INTERACTION] Command not found: ${interaction.commandName}`);
        return;
      }
      await command.execute(interaction);
      console.log(`[INTERACTION] Successfully executed command: ${interaction.commandName}`);
    }
  } catch (error) {
    console.error('[INTERACTION] Error processing interaction:', error);
    const response = { content: '⚠️ An error occurred', ephemeral: true };
    
    if (interaction.deferred || interaction.replied) {
      console.log('[INTERACTION] Sending follow-up error message');
      await interaction.followUp(response);
    } else {
      console.log('[INTERACTION] Sending initial error message');
      await interaction.reply(response);
    }
  }
});

console.log('[DISCORD] Setting client in manager...');
setClient(discordClient);

// Message handling
console.log('[DISCORD] Setting up message handler...');
discordClient.on('messageCreate', async message => {
  console.log(`[MESSAGE] Received message from ${message.author.tag} in ${message.channel.name}`);
  
  if (message.author.bot) {
    console.log('[MESSAGE] Ignoring bot message');
    return;
  }

  const prefix = '!';
  
  // Prefix commands
  if (message.content.startsWith(prefix)) {
    console.log('[MESSAGE] Processing prefix command');
    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();
    
    console.log(`[COMMAND] Prefix command detected: ${commandName}`);
    const command = discordClient.prefixCommands.get(commandName);
    
    if (!command) {
      console.log(`[COMMAND] Unknown prefix command: ${commandName}`);
      return;
    }
    
    try {
      console.log(`[COMMAND] Executing prefix command: ${commandName}`);
      await command.execute(message, args);
      console.log(`[COMMAND] Successfully executed prefix command: ${commandName}`);
    } catch (error) {
      console.error('[COMMAND] Prefix command error:', error);
      await message.reply('Command error');
    }
    return;
  }

  // Metro alert forwarding
  if (message.channel.id !== '1377398484931575938') {
    console.log('[MESSAGE] Not metro alert channel, ignoring');
    return;
  }
  
  console.log('[METRO] Processing metro alert message');
  const targetChannel = await discordClient.channels.fetch('1347146518943105085');
  if (!targetChannel) {
    console.error('[METRO] Target channel not found');
    return;
  }

  try {
    console.log('[METRO] Parsing alert content');
    let urgency = '';
    const firstChar = message.content.split(" ")[0].trim();
    if (firstChar) {
      urgency = _translateUrgencyEmoji(firstChar);
      console.log(`[METRO] Detected urgency level: ${urgency}`);
    }

    let title = '';
    let content = message.content;
    const titleMatch = content.match(/\$&(.*?)\$&/);
    if (titleMatch) {
      title = titleMatch[1].trim();
      content = content.replace(titleMatch[0], '').trim();
      console.log(`[METRO] Extracted title: ${title}`);
    }

    content = _processLineKeywords(content);
    console.log('[METRO] Processed content with line keywords');

    console.log('[METRO] Building embed');
    const embed = new EmbedBuilder()
      .setDescription(content)
      .setColor(_getUrgencyColor(urgency))
      .setTimestamp();

    if (title) embed.setTitle(title);
    if (urgency) embed.setAuthor({ name: `Urgency: ${urgency}` });

    const options = { embeds: [embed] };
    if (message.attachments.size > 0) {
      options.files = [...message.attachments.values()];
      console.log(`[METRO] Including ${message.attachments.size} attachments`);
    }

    console.log('[METRO] Sending alert to target channel');
    await targetChannel.send(options);

    // Telegram message handling
    console.log('[TELEGRAM] Preparing telegram message');
    let telegramMessage = '';
    
    if (firstChar) {
      const telegramEmoji = _translateToTelegramEmoji(firstChar);
      telegramMessage += `${telegramEmoji} `;
      console.log(`[TELEGRAM] Added urgency emoji: ${telegramEmoji}`);
    }
    
    telegramMessage += `<b>Información Metro</b>\n`;
    if (title) telegramMessage += `<b>${title}</b>\n`;
    
    const telegramContent = _processForTelegram(content);
    telegramMessage += telegramContent;

    console.log('[TELEGRAM] Sending message to Telegram channel');
    await telegramBot.sendToChannel(telegramMessage, {
      reply_markup: {
        inline_keyboard: [[
          { text: 'Ver en Discord', url: message.url }
        ]]
      }
    });

    console.log('[METRO] Alert successfully processed and forwarded');
  } catch (error) {
    console.error('[METRO] Error forwarding message:', error);
  }
});

// Helper functions with logging
function _translateToTelegramEmoji(discordEmoji) {
  console.log(`[UTIL] Translating Discord emoji to Telegram: ${discordEmoji}`);
  const emojiMap = {
    '🚨': '🚨', '⚠️': '⚠️', 'ℹ️': 'ℹ️',
    '🔵': '🔵', '🟢': '🟢', 
    '🟡': '🟡', '🔴': '🔴'
  };
  return emojiMap[discordEmoji] || '';
}

function _processForTelegram(text) {
  console.log('[UTIL] Processing text for Telegram');
  if (typeof text !== 'string') return text;
  
  let processedText = text
    .replace(/\bl1\b/gi, 'Línea 1')
    .replace(/\bl2\b/gi, 'Línea 2')
    .replace(/\bl3\b/gi, 'Línea 3')
    .replace(/\bl4\b/gi, 'Línea 4')
    .replace(/\bl4a\b/gi, 'Línea 4A')
    .replace(/\bl5\b/gi, 'Línea 5')
    .replace(/\bl6\b/gi, 'Línea 6')
    .replace(/\bl7\b/gi, 'Línea 7')
    .replace(/\bl8\b/gi, 'Línea 8')
    .replace(/\bl9\b/gi, 'Línea 9')
    .replace(/\$verde/gi, '[Estación Verde]')
    .replace(/\$roja/gi, '[Estación Roja]')
    .replace(/\$comun/gi, '[Estación Común]');
    
  console.log('[UTIL] Telegram text processing complete');
  return processedText;
}

function _translateUrgencyEmoji(emoji) {
  console.log(`[UTIL] Translating urgency emoji: ${emoji}`);
  const urgencyMap = {
    '🚨': 'Alta', '⚠️': 'Media', 'ℹ️': 'Baja',
    '🔵': 'Informativa', '🟢': 'Normal',
    '🟡': 'Advertencia', '🔴': 'Crítica'
  };
  return urgencyMap[emoji] || '';
}

function _getUrgencyColor(urgency) {
  console.log(`[UTIL] Getting color for urgency: ${urgency}`);
  const colorMap = {
    'Alta': 0xFF0000, 'Media': 0xFFA500,
    'Baja': 0xFFFF00, 'Informativa': 0x0000FF,
    'Normal': 0x00FF00, 'Advertencia': 0xFFA500,
    'Crítica': 0xFF0000
  };
  return colorMap[urgency] || 0x3498DB;
}

function _processLineKeywords(text) {
  console.log('[UTIL] Processing line keywords in text');
  if (typeof text !== 'string') return text;
  let processedText = text
    .replace(/\bl1\b/gi, metroConfig.linesEmojis.l1)
    .replace(/\bl2\b/gi, metroConfig.linesEmojis.l2)
    .replace(/\bl3\b/gi, metroConfig.linesEmojis.l3)
    .replace(/\bl4\b/gi, metroConfig.linesEmojis.l4)
    .replace(/\bl4a\b/gi, metroConfig.linesEmojis.l4a)
    .replace(/\bl5\b/gi, metroConfig.linesEmojis.l5)
    .replace(/\bl6\b/gi, metroConfig.linesEmojis.l6)
    .replace(/\bl7\b/gi, metroConfig.linesEmojis.l7)
    .replace(/\bl8\b/gi, metroConfig.linesEmojis.l8)
    .replace(/\bl9\b/gi, metroConfig.linesEmojis.l9)
    .replace(/\$verde/gi, metroConfig.stationIcons.verde.emoji)
    .replace(/\$roja/gi, metroConfig.stationIcons.roja.emoji)
    .replace(/\$comun/gi, `${metroConfig.stationIcons.comun.emoji}`);
  return processedText;
}

// ======================
// TELEGRAM BOT INITIALIZATION
// ======================
console.log('[TELEGRAM] Loading Telegram bot module...');
const TelegramBot = require('./Telegram/bot');
const telegramBot = TelegramBot;

// Launch Both Bots


// Modified Launch Sequence
console.log('[BOOT] Starting bot launch sequence...');
(async () => {
  try {
    // Start Discord with better error handling
    console.log('[DISCORD] Attempting login...');
    
    if (!process.env.DISCORD_TOKEN) {
      throw new Error('DISCORD_TOKEN is not defined in environment variables');
    }

    // Add connection state logging
    discordClient.on('ready', () => {
      console.log(`✅ Discord bot ready as ${discordClient.user.tag}`);
    });

    discordClient.on('disconnect', () => {
      console.warn('[DISCORD] Client disconnected');
    });

    discordClient.on('reconnecting', () => {
      console.log('[DISCORD] Client reconnecting...');
    });

    discordClient.on('warn', info => {
      console.warn(`[DISCORD WARNING] ${info}`);
    });

    discordClient.on('error', error => {
      console.error(`[DISCORD ERROR] ${error}`);
    });

    // Add login timeout
    const loginTimeout = setTimeout(() => {
      console.error('[DISCORD] Login timed out (30 seconds)');
      process.exit(1);
    }, 30000);

    await discordClient.login(process.env.DISCORD_TOKEN)
      .then(() => {
        clearTimeout(loginTimeout);
        console.log('[DISCORD] Login successful');
      })
      .catch(error => {
        clearTimeout(loginTimeout);
        console.error('[DISCORD] Login failed:', error);
        process.exit(1);
      });

    // Start Telegram
    console.log('[TELEGRAM] Launching...');
    await telegramBot.launch()
      .then(() => console.log('✅ Telegram bot ready'))
      .catch(error => {
        console.error('[TELEGRAM] Launch failed:', error);
        process.exit(1);
      });

    // Graceful shutdown
    console.log('[BOOT] Setting up shutdown handlers...');
    const shutdown = async (signal) => {
      console.log(`[SHUTDOWN] Received ${signal}, shutting down...`);
      try {
        await discordClient.destroy();
        console.log('[DISCORD] Client destroyed');
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

    console.log('[BOOT] All systems operational');
  } catch (error) {
    console.error('[BOOT] Startup failed:', error);
    process.exit(1);
  }
})();
