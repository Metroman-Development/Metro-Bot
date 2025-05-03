require('dotenv').config();

const { Client, GatewayIntentBits, Collection } = require('discord.js');

const { readdirSync } = require('fs');

const { join } = require('path');

const logger = require('./events/logger');

const loadEvents = require('./events');

const NewsWatcher = require('./events/NewsWatcher');

const AdvancedCommandLoader = require('./core/loaders/AdvancedCommandLoader'); // New command loader

const { setClient} = require('./utils/clientManager') 



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

  if (!message.content.startsWith(prefix)) return;

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

});

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

    logger.error('LOGIN_FAILED', error);

    process.exit(1);

  });
