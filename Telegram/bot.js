const { Telegraf } = require('telegraf');
const config = require('./config');
const pingCommand = require('./commands/ping');

class TelegramBot {
  constructor() {
    this.bot = new Telegraf(process.env.TELEGRAM_TOKEN);
    this._loadCommands();
    
    this.channelId = process.env.TELEGRAM_CHANNEL_ID; // Add to .env
    }

  // Add this new method
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

   

  // Add this new method
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

  
  async sendCompactAnnouncement(changes, allStations = {}) {
    try {
         
      if (messages.length === 0) {
        return;
      }
      
      // Combine messages with double newlines between them
      const combinedMessage = messages.join('\n\n');
      await this.sendToChannel(combinedMessage);
    } catch (error) {
      console.error('Failed to send compact announcement:', error);
    }
  }

 

  _loadCommands() {
    // Register commands
    this.bot.command('ping', pingCommand.execute);

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

module.exports = TelegramBot;
