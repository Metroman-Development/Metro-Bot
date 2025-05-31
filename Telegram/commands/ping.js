module.exports = {
  execute: (ctx) => {
    const start = Date.now();
    ctx.reply('Pong!').then(() => {
      const latency = Date.now() - start;
      ctx.reply(`Latency: ${latency}ms`);
    });
  }
};
