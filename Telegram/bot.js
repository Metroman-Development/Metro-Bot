const { Telegraf } = require('telegraf');
const config = require('./config');
const pingCommand = require('./commands/ping');

class TelegramBot {
  constructor() {
    this.bot = new Telegraf(process.env.TELEGRAM_TOKEN);
    this._loadCommands();
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
