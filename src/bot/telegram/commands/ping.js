module.exports = {
  execute: async (ctx) => {
    const startTime = Date.now();
    const message = await ctx.reply('🏓 Pong!');
    const endTime = Date.now();
    const latency = endTime - startTime;

    await ctx.telegram.editMessageText(
      ctx.chat.id,
      message.message_id,
      null,
      `🏓 **Pong!**\n- Latencia: \`${latency}ms\``,
      { parse_mode: 'Markdown' }
    );
  },
  description: 'Mide la latencia del bot.',
};
