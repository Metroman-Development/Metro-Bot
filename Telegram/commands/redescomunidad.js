// commands/redes.js
module.exports = {
  execute: (ctx) => {
    const message = `📢 <b>Redes Sociales de la Comunidad</b> 📢\n\n` +
      `💬 <b>Discord:</b> https://discord.gg/z7AfQZZaGD\n` +
      `📱 <b>WhatsApp:</b> https://chat.whatsapp.com/H1ECcZwlVxZFpwmG85GxCB\n` +
      `🟥 <b>Reddit:</b> https://www.reddit.com/r/metrosantiago/s/S9wvlFkjjF\n` +
      `📨 <b>Telegram:</b> https://t.me/metrosantiago\n\n` +
      `¡Únete a nuestras comunidades!`;
    
    ctx.replyWithHTML(message);
  }
};
