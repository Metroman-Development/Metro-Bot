module.exports = {
  execute: async (ctx) => {
    const chat = ctx.chat;
    const chatInfo = `
**Información del Chat:**
- **ID:** \`${chat.id}\`
- **Título:** ${chat.title}
- **Tipo:** ${chat.type}
    `;
    await ctx.replyWithMarkdown(chatInfo);
  },
  description: 'Muestra información sobre el chat actual.',
};
