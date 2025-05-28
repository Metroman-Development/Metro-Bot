require('dotenv').config();

const { Client, GatewayIntentBits, Collection } = require('discord.js');
const { EmbedBuilder } = require('discord.js');

const { readdirSync } = require('fs');

const { join } = require('path');

const logger = require('./events/logger');

const loadEvents = require('./events');

const NewsWatcher = require('./events/NewsWatcher');

const AdvancedCommandLoader = require('./core/loaders/AdvancedCommandLoader'); // New command loader

const { setClient} = require('./utils/clientManager') 

const metroConfig = require('./config/metro/metroConfig')

// Initialize client with necessary intents

const client = new Client({

  intents: [

    GatewayIntentBits.Guilds,

    GatewayIntentBits.GuildMessages,

    GatewayIntentBits.MessageContent,

    GatewayIntentBits.GuildMembers // Added for role-based permissions

  ]

});

loadEvents(client);
client.on('debug', console.log);

// Collections for command storage (maintained for compatibility)

client.commands = new Collection();

// In your index.js/client setup:
   client.metroCore = require('./modules/metro/core/MetroCore');

client.prefixCommands = new Collection();

// ======================

// COMMAND REGISTRATION

// ======================

// Initialize new command loader

client.commandLoader = new AdvancedCommandLoader(client);

// Maintain legacy prefix command loading


const prefixCommandsPath = join(__dirname, 'prefixCommands');

readdirSync(prefixCommandsPath)

  .filter(file => file.endsWith('.js'))

  .forEach(file => {

    const command = require(join(prefixCommandsPath, file));

    if ('name' in command && 'execute' in command) {

      client.prefixCommands.set(command.name, command);

    }

  });

// ======================

// INTERACTION HANDLING

// ======================
setClient(client); 


const interactionHandler = require('./modules/interactions/interactionHandler');



client.on('interactionCreate', async interaction => {
    
 // console.log("Interacción Recibida ", interaction);

  try {

    // Handle component interactions

    if (

      interaction.isButton() || 

      interaction.isAnySelectMenu() || 

      interaction.isModalSubmit() ||

      interaction.isContextMenuCommand()

    ) {

      return interactionHandler.execute(interaction);

    }

    // Handle slash commands

    if (interaction.isCommand()) {

      const command = client.commands.get(interaction.commandName);

      if (!command) return;

      await command.execute(interaction);

    }

  } catch (error) {

    console.error('Error procesando interacción:', error);

    

    const response = {

      content: '⚠️ Ocurrió un error al procesar esta interacción',

      ephemeral: true

    };

    if (interaction.deferred || interaction.replied) {

      await interaction.followUp(response);

    } else {

      await interaction.reply(response);

    }

  }

});

// ======================

// MESSAGE COMMANDS (LEGACY)

// ======================

client.on('messageCreate', async message => {

  if (message.author.bot) return;

  const prefix = '!';

  if (message.content.startsWith(prefix)) {

  const args = message.content.slice(prefix.length).trim().split(/ +/);

  const commandName = args.shift().toLowerCase();

  const command = client.prefixCommands.get(commandName);

  if (!command) return;

  try {

    await command.execute(message, args);

  } catch (error) {

    console.error('Error en comando de prefijo:', error);

    await message.reply('Ocurrió un error al ejecutar ese comando.');

  }

 }
    if ( message.channel.id !== '1377398484931575938') return;

    


    const targetChannel = await client.channels.fetch('1347146518943105085');
    if (!targetChannel) return;

    try {
        // Parse urgency emoji (first character if it's a known emoji)
        let urgency = '';
        const firstChar = message.content.split(" ")[0].trim();
        if (firstChar) {
            urgency = _translateUrgencyEmoji(firstChar);
        }

        // Extract title (content between $& $&)
        let title = '';
        let content = message.content;
        const titleMatch = content.match(/\$&(.*?)\$&/);
        if (titleMatch) {
            title = titleMatch[1].trim();
            content = content.replace(titleMatch[0], '').trim();
        }

        // Process line keywords (l1, l2, etc.)
        content = _processLineKeywords(content);

        // Create embed
        const embed = new EmbedBuilder()
            .setDescription(content)
            .setColor(_getUrgencyColor(urgency))
            .setTimestamp();

        if (title) embed.setTitle(title);
        if (urgency) embed.setAuthor({ name: `Urgency: ${urgency}` });

        // Prepare message options
        const options = { embeds: [embed] };

        // Add attachments if present
        if (message.attachments.size > 0) {
            options.files = [...message.attachments.values()];
        }

        // Send to target channel
        await targetChannel.send(options);

    } catch (error) {
        console.error('Error resending message:', error);
    }

})
// Helper functions (add these as methods to your client or module)
function _translateUrgencyEmoji(emoji) {

  console.log(emoji);
  
  const urgencyMap = {
        '🚨': 'Alta',
        '⚠️': 'Media',
        'ℹ️': 'Baja',
        '🔵': 'Informativa',
        '🟢': 'Normal',
        '🟡': 'Advertencia',
        '🔴': 'Crítica'
    };
    return urgencyMap[emoji] || '';
}

function _getUrgencyColor(urgency) {
    const colorMap = {
        'Alta': 0xFF0000,
        'Media': 0xFFA500,
        'Baja': 0xFFFF00,
        'Informativa': 0x0000FF,
        'Normal': 0x00FF00,
        'Advertencia': 0xFFA500,
        'Crítica': 0xFF0000
    };
    return colorMap[urgency] || 0x3498DB; // Default blue
}

function _processLineKeywords(text) {
    if (typeof text !== 'string') return text;

    // Finally process standalone line codes (l1, l2, etc.)
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
        .replace(/\bl9\b/gi, metroConfig.linesEmojis.l9);
    
  
    // First process line numbers (Línea X)
    processedText = processedText
        .replace(/\blínea\s*1\b/gi, `Línea ${metroConfig.linesEmojis.l1}`)
        .replace(/\blínea\s*2\b/gi, `Línea ${metroConfig.linesEmojis.l2}`)
        .replace(/\blínea\s*3\b/gi, `Línea ${metroConfig.linesEmojis.l3}`)
        .replace(/\blínea\s*4\b/gi, `Línea ${metroConfig.linesEmojis.l4}`)
        .replace(/\blínea\s*4a\b/gi, `Línea ${metroConfig.linesEmojis.l4a}`)
        .replace(/\blínea\s*5\b/gi, `Línea ${metroConfig.linesEmojis.l5}`)
        .replace(/\blínea\s*6\b/gi, `Línea ${metroConfig.linesEmojis.l6}`)
        .replace(/\blínea\s*7\b/gi, `Línea ${metroConfig.linesEmojis.l7}`)
        .replace(/\blínea\s*8\b/gi, `Línea ${metroConfig.linesEmojis.l8}`)
        .replace(/\blínea\s*9\b/gi, `Línea ${metroConfig.linesEmojis.l9}`)
        .replace(/\bruta\s*🔴\b/gi, metroConfig.stationIcons.roja.emoji)
        .replace(/\bruta\s*🟢\b/gi, metroConfig.stationIcons.verde.emoji)
        .replace(/\bruta\s*🔴\s*🟢/gi, `${metroConfig.stationIcons.comun.emoji}`)
        .replace(/\bruta\s*🟢\s*🔴/gi, `${metroConfig.stationIcons.comun.emoji}`);
    
    
    return processedText;
}
 

// ======================

// INITIALIZATION

// ======================

/*const newsWatcher = new NewsWatcher(client, '899842767096791060');

newsWatcher.initialize();*/



// ======================

// PROCESS HANDLING

// ======================

process.on('unhandledRejection', error => {

  logger.error('UNHANDLED_REJECTION', error);

     console.error('UNHANDLED_REJECTION', error);
});

process.on('SIGINT', async () => {

  logger.info('SHUTDOWN', 'Apagado iniciado');

  try {

    newsWatcher.stopWatching();

    await client.destroy();

    process.exit(0);

  } catch (error) {

    logger.error('SHUTDOWN_FAILED', error);

    process.exit(1);

  }

});

// Start bot


client.login(process.env.DISCORD_TOKEN)

  .catch(error => {

    console.error('LOGIN_FAILED', error);

    process.exit(1);

  });

console.log("Bot logged in successfully") 

