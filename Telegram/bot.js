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
  }

  async _logForumTopicsOnStartup() {
    try {
      // Use the configured channel ID or replace with your forum group ID
      const forumChatId = this.channelId; // Format: -1001234567890
      
      if (!forumChatId) {
        console.warn('⚠️ No channel/forum ID configured. Skipping topic logging.');
        return;
      }

      // Use the correct method name for getting forum topics
      const result = await this.bot.telegram.callApi('getForumTopics', {
        chat_id: forumChatId
      });
      
      if (!result.topics || result.topics.length === 0) {
        console.log('ℹ️ No topics found in the forum group.');
        return;
      }

      console.log('\n📢 ACTIVE FORUM TOPICS:');
      console.log('----------------------');
      result.topics.forEach((topic, index) => {
        console.log(`${index + 1}. ${topic.name} (Thread ID: ${topic.message_thread_id})`);
      });
      console.log('\n');

    } catch (error) {
      console.error('❌ TOPIC LOGGING ERROR:', error.message);
      if (error.response) {
        console.error('Telegram API Response:', error.response.description);
      }
      // Don't throw the error, just log it and continue
      console.log('ℹ️ Continuing bot startup without forum topics logging...');
    }
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
      if (messages.length === 0) return;
      await this.sendToChannel(messages.join('\n\n'));
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
          console.log(`✅ Registered command: /${commandName}`);
          
          if (command.registerActions && typeof command.registerActions === 'function') {
            command.registerActions(this.bot);
            console.log(`   ↳ Registered actions for: /${commandName}`);
          }
        } else {
          console.warn(`⚠️ Skipping ${file} - missing execute function`);
        }
      } catch (error) {
        console.error(`❌ Error loading command ${file}:`, error);
      }
    }

    this.bot.catch((err, ctx) => {
      console.error('⚠️ Telegram Bot Error:', err);
      ctx.reply('An error occurred. Please try again later.');
    });
  }

  launch() {
    this._logForumTopicsOnStartup(); // Log topics immediately on launch
    return this.bot.launch()
      .then(() => console.log('🤖 Bot is now running'))
      .catch(err => console.error('‼️ Bot launch failed:', err));
  }

  stop(reason) {
    this.bot.stop(reason);
    console.log(`🛑 Bot stopped: ${reason || 'No reason provided'}`);
  }
}

module.exports = new TelegramBot();
