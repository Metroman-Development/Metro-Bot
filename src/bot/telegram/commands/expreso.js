const { MetroInfoProvider } = require('../../../utils/MetroInfoProvider');

module.exports = {
  execute: async (ctx) => {
    const args = ctx.message.text.split(' ').slice(1);
    const line = args[0];

    if (!line) {
      return ctx.reply('Por favor, especifica una línea. Ejemplo: /expreso l2');
    }

    const metroInfoProvider = MetroInfoProvider.getInstance();
    const expressData = metroInfoProvider.getExpressData(line);

    if (!expressData) {
      return ctx.reply(`No se encontró información de ruta expresa para la línea ${line}.`);
    }

    let response = `**Ruta Expresa - Línea ${line.toUpperCase()}**\n\n`;
    response += `**Ruta Roja:**\n${expressData.roja.join(', ')}\n\n`;
    response += `**Ruta Verde:**\n${expressData.verde.join(', ')}\n\n`;
    response += `**Estaciones Comunes:**\n${expressData.comun.join(', ')}`;

    await ctx.replyWithMarkdown(response);
  },
  description: 'Muestra información sobre las rutas expresas.',
};
