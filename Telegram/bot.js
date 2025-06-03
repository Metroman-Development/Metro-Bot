const { Telegraf } = require('telegraf');
const fs = require('fs');
const path = require('path');
const config = require('./config');

class TelegramBot {
  constructor() {
    this.bot = new Telegraf(process.env.TELEGRAM_TOKEN);
    this._loadCommands();
    this._setupWelcomeHandler(); // Add welcome handler setup
    this.channelId = process.env.TELEGRAM_CHANNEL_ID;
  }

  _setupWelcomeHandler() {
    this.bot.on('new_chat_members', (ctx) => {
      // Handle each new member
      ctx.message.new_chat_members.forEach((newMember) => {
        const welcomeMessage = 
          `Bienvenido ${newMember.first_name} a la Comunidad Social Informativa y de Reportes del Metro de Santiago 🚇🫂. Esperamos que lo pases bien con nosotros.`;
        
        ctx.reply(welcomeMessage, {
          parse_mode: 'HTML'
        });
      });
    });
  }

  async sendToChannel(message, options = {}) {
  try {
    // Convert Discord emojis and special line formats
    const processedMessage = message
      // Convert Discord emoji format <:name:id> to :NAME:
      .replace(/<:[a-zA-Z0-9_]+:(\d+)>/g, (match) => {
        const emojiName = match.match(/<:([a-zA-Z0-9_]+):/)[1];
        return `:${emojiName.toUpperCase()}:`;
      })
      // Convert special line formats to proper Spanish names
      .replace(/:LINEA([A1-6]|4A):/gi, (match, line) => {
        return `Línea ${line.toUpperCase()}`;
      });

    await this.bot.telegram.sendMessage(
      this.channelId, 
      processedMessage, 
      { parse_mode: 'HTML', ...options }
    );
  } catch (error) {
    console.error('Failed to send to Telegram channel:', error);
  }
}
  
  async sendCompactAnnouncement(messages) {
    try {
      if (messages.length === 0) {
        return;
      }
      
      const combinedMessage = messages.join('\n\n');
      await this.sendToChannel(combinedMessage);
    } catch (error) {
      console.error('Failed to send compact announcement:', error);
    }
  }

  _loadCommands() {
  // Get all files in the commands directory
  const commandsPath = path.join(__dirname, 'commands');
  const commandFiles = fs.readdirSync(commandsPath).filter(file => 
    file.endsWith('.js') && !file.startsWith('.')
  );

  // Dynamically register each command
  for (const file of commandFiles) {
    try {
      const command = require(path.join(commandsPath, file));
      const commandName = file.replace('.js', '').toLowerCase();
      
      if (command.execute && typeof command.execute === 'function') {
        this.bot.command(commandName, command.execute);
        console.log(`Registered command: /${commandName}`);
        
        // Register action handlers if the command has them
        if (command.registerActions && typeof command.registerActions === 'function') {
          command.registerActions(this.bot);
          console.log(`Registered actions for: /${commandName}`);
        }
      } else {
        console.warn(`Skipping ${file} - missing execute function`);
      }
    } catch (error) {
      console.error(`Error loading command ${file}:`, error);
    }
  }

   this.bot.catch((err, ctx) => {
    console.error('Telegram Bot Error:', err);
    ctx.reply('⚠️ An error occurred.');
  });
  }

  launch() {
    return this.bot.launch();
  }

  stop(reason) {
    this.bot.stop(reason);
  }
}

module.exports = new TelegramBot();
