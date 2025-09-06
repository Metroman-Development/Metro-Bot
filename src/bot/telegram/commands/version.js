const { version } = require('../../../../package.json');

module.exports = {
  execute: async (ctx) => {
    await ctx.reply(`🤖 Mi versión actual es la **${version}**`, { parse_mode: 'Markdown' });
  },
  description: 'Muestra la versión actual del bot.',
};
