const { Telegraf } = require('telegraf');
const fs = require('fs');
const path = require('path');
const config = require('./config');

class TelegramBot {
  constructor() {
    this.bot = new Telegraf(process.env.TELEGRAM_TOKEN);
    this._loadCommands();
    this._setupWelcomeHandler();
    this.channelId = process.env.TELEGRAM_CHANNEL_ID;
    this.topicId = 4; // Your specified topic ID
  }

  _setupWelcomeHandler() {
    this.bot.on('new_chat_members', (ctx) => {
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
      const processedMessage = message
        .replace(/<:[a-zA-Z0-9_]+:(\d+)>/g, (match) => {
          const emojiName = match.match(/<:([a-zA-Z0-9_]+):/)[1];
          return `:${emojiName.toUpperCase()}:`;
        })
        .replace(/:LINEA([A1-6]|4A):/gi, (match, line) => {
          return `Línea ${line.toUpperCase()}`;
        });

      // Modified to include topic ID
      await this.bot.telegram.sendMessage(
        this.channelId, 
        processedMessage, 
        { 
          parse_mode: 'HTML',
          message_thread_id: this.topicId, // Add topic ID here
         // ...options 
        }
      );
    } catch (error) {
      console.error('Failed to send to Telegram channel:', error);
      if (error.response) {
        console.error('Telegram API Error:', error.response.description);
      }
    }
  }
  
  async sendCompactAnnouncement(messages) {
    try {
      if (messages.length === 0) return;
      
      // Modified to include topic ID
      await this.bot.telegram.sendMessage(
        this.channelId,
        messages.join('\n\n'),
        {
          message_thread_id: this.topicId // Add topic ID here
        }
      );
    } catch (error) {
      console.error('Failed to send compact announcement:', error);
    }
  }

  _loadCommands() {
    const commandsPath = path.join(__dirname, 'commands');
    const commandFiles = fs.readdirSync(commandsPath).filter(file => 
      file.endsWith('.js') && !file.startsWith('.')
    );

    for (const file of commandFiles) {
      try {
        const command = require(path.join(commandsPath, file));
        const commandName = file.replace('.js', '').toLowerCase();
        
        if (command.execute && typeof command.execute === 'function') {
          this.bot.command(commandName, command.execute);
          console.log(`Registered command: /${commandName}`);
          
          if (command.registerActions && typeof command.registerActions === 'function') {
            command.registerActions(this.bot);
            console.log(`Registered actions for: /${commandName}`);
          }
        }
      } catch (error) {
        console.error(`Error loading command ${file}:`, error);
      }
    }

    this.bot.catch((err, ctx) => {
      console.error('Telegram Bot Error:', err);
      ctx.reply('An error occurred. Please try again later.');
    });

    bot.use(
  session({
    defaultSession: () => ({})
  })
);
  }

  launch() {
    return this.bot.launch();
  }

  stop(reason) {
    this.bot.stop(reason);
  }
}

module.exports = new TelegramBot();
