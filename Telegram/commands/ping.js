module.exports = {
  description: 'Pong! Latencia', 
  execute: (ctx) => {
    const start = Date.now();
    ctx.reply('Pong!').then(() => {
      const latency = Date.now() - start;
      ctx.reply(`Latency: ${latency}ms`);
    });
  }
};
