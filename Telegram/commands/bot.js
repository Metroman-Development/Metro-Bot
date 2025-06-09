

module.exports = {
  execute: (ctx) => {
    const os = require('os');
    const process = require('process');
    
    // Calculate uptime
    const formatUptime = (seconds) => {
      const days = Math.floor(seconds / (3600 * 24));
      seconds %= 3600 * 24;
      const hours = Math.floor(seconds / 3600);
      seconds %= 3600;
      const minutes = Math.floor(seconds / 60);
      seconds = Math.floor(seconds % 60);
      return `${days}d ${hours}h ${minutes}m ${seconds}s`;
    };
    
    const uptime = formatUptime(process.uptime());
    
    // Get memory usage
    const memoryUsage = process.memoryUsage().rss / 1024 / 1024;
    const totalMemory = os.totalmem() / 1024 / 1024 / 1024;
    
    // Get bot information
    const botUsername = ctx.botInfo.username;
    const botCreatedAt = new Date(ctx.botInfo.createdAt * 1000).toLocaleDateString();
    
    // Create message text
    const messageText = `
🤖 *Información del Bot*

- Bot Creado por MetroMan
- Es de código abierto, puedes contribuir [aquí](https://github.com/MetroManSR/MetroBot) 
- Este bot fue diseñado con la finalidad de entregar información y alertas al momento acerca de la Red de Metro de Santiago. 

⏱️ *Uptime*: ${uptime}
📊 *Uso de memoria*: ${memoryUsage.toFixed(2)} MB
🖥️ *Servidor*: ${os.type()} ${os.release()}
💾 *RAM total*: ${totalMemory.toFixed(2)} GB
📅 *Creado el*: 3/3/2025
    
_Solicitado por ${ctx.from.first_name}_
    `;
    
    // Create reply with inline button
    const replyOptions = {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: 'Únete al Discord de la Comunidad',
              url: 'https://discord.gg/2zfHGbvc8p'
            }
          ]
        ]
      }
    };
    
    // Send the message
    ctx.reply(messageText, replyOptions);
  }
};
