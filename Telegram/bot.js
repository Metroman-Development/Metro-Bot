const { Telegraf } = require('telegraf');
const fs = require('fs');
const path = require('path');
const config = require('./config');

class TelegramBot {
  constructor() {
    this.bot = new Telegraf(process.env.TELEGRAM_TOKEN);
    this._loadCommands();
    this.channelId = process.env.TELEGRAM_CHANNEL_ID;
  }

  async sendToChannel(message, options = {}) {
    try {
      await this.bot.telegram.sendMessage(
        this.channelId, 
        message, 
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
        } else {
          console.warn(`Skipping ${file} - missing execute function`);
        }
      } catch (error) {
        console.error(`Error loading command ${file}:`, error);
      }
    }

    // Error handling
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
