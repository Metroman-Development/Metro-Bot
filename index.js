require('dotenv').config();

// ======================
// DISCORD BOT (Original Code - Preserved)
// ======================
const { Client, GatewayIntentBits, Collection, EmbedBuilder } = require('discord.js');
const { readdirSync } = require('fs');
const { join } = require('path');
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

// Load events and commands
loadEvents(discordClient);
discordClient.on('debug', console.log);

discordClient.commands = new Collection();
discordClient.prefixCommands = new Collection();
discordClient.metroCore = require('./modules/metro/core/MetroCore');

// Initialize command loader
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
const interactionHandler = require('./modules/interactions/interactionHandler');
discordClient.on('interactionCreate', async interaction => {
  try {
    if (interaction.isButton() || interaction.isAnySelectMenu() || interaction.isModalSubmit() || interaction.isContextMenuCommand()) {
      return interactionHandler.execute(interaction);
    }
    if (interaction.isCommand()) {
      const command = discordClient.commands.get(interaction.commandName);
      if (!command) return;
      await command.execute(interaction);
    }
  } catch (error) {
    console.error('Error processing interaction:', error);
    const response = { content: '⚠️ An error occurred', ephemeral: true };
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(response);
    } else {
      await interaction.reply(response);
    }
  }
});

setClient(discordClient) 

// Message handling (your original metro alert system)
discordClient.on('messageCreate', async message => {
  if (message.author.bot) return;
  const prefix = '!';
  
  // Prefix commands
  if (message.content.startsWith(prefix)) {
    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();
    const command = discordClient.prefixCommands.get(commandName);
    if (!command) return;
    try {
      await command.execute(message, args);
    } catch (error) {
      console.error('Prefix command error:', error);
      await message.reply('Command error');
    }
  }

  // Metro alert forwarding (your original code)
  if (message.channel.id !== '1377398484931575938') return;
  const targetChannel = await discordClient.channels.fetch('1347146518943105085');
  if (!targetChannel) return;

  try {
    let urgency = '';
    const firstChar = message.content.split(" ")[0].trim();
    if (firstChar) urgency = _translateUrgencyEmoji(firstChar);

    let title = '';
    let content = message.content;
    const titleMatch = content.match(/\$&(.*?)\$&/);
    if (titleMatch) {
      title = titleMatch[1].trim();
      content = content.replace(titleMatch[0], '').trim();
    }

    content = _processLineKeywords(content);

    const embed = new EmbedBuilder()
      .setDescription(content)
      .setColor(_getUrgencyColor(urgency))
      .setTimestamp();

    if (title) embed.setTitle(title);
    if (urgency) embed.setAuthor({ name: `Urgency: ${urgency}` });

    const options = { embeds: [embed] };
    if (message.attachments.size > 0) {
      options.files = [...message.attachments.values()];
    }

    await targetChannel.send(options);
  } catch (error) {
    console.error('Error forwarding message:', error);
  }
});

// Helper functions (preserved)
function _translateUrgencyEmoji(emoji) {
  const urgencyMap = {
    '🚨': 'Alta', '⚠️': 'Media', 'ℹ️': 'Baja',
    '🔵': 'Informativa', '🟢': 'Normal',
    '🟡': 'Advertencia', '🔴': 'Crítica'
  };
  return urgencyMap[emoji] || '';
}

function _getUrgencyColor(urgency) {
  const colorMap = {
    'Alta': 0xFF0000, 'Media': 0xFFA500,
    'Baja': 0xFFFF00, 'Informativa': 0x0000FF,
    'Normal': 0x00FF00, 'Advertencia': 0xFFA500,
    'Crítica': 0xFF0000
  };
  return colorMap[urgency] || 0x3498DB;
}

function _processLineKeywords(text) {
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
// TELEGRAM BOT (New Code)
// ======================
const { Telegraf } = require('telegraf');
const telegramBot = new Telegraf(process.env.TELEGRAM_TOKEN);

// Reuse your metroConfig for Telegram
telegramBot.command('metro', (ctx) => {
  const lines = Object.entries(metroConfig.linesEmojis)
    .map(([line, emoji]) => `${line}: ${emoji}`)
    .join('\n');
  
  ctx.replyWithHTML(`<b>🚇 Metro Lines</b>\n${lines}`);
});

// Error handling
telegramBot.catch((err, ctx) => {
  console.error('Telegram error:', err);
  ctx.reply('⚠️ Bot error occurred');
});

// ======================
// LAUNCH BOTH BOTS
// ======================
(async () => {
  try {
    // Start Discord
    await discordClient.login(process.env.DISCORD_TOKEN);
    console.log('Discord bot ready');

    // Start Telegram
    await telegramBot.launch();
    console.log('Telegram bot ready');

    // Graceful shutdown
    process.once('SIGINT', () => {
      discordClient.destroy();
      telegramBot.stop('SIGINT');
    });
    process.once('SIGTERM', () => {
      discordClient.destroy();
      telegramBot.stop('SIGTERM');
    });
  } catch (error) {
    console.error('Startup failed:', error);
    process.exit(1);
  }
})();
