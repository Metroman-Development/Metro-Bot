const SearchCore = require('../../../core/metro/search/SearchCore');
const { MetroInfoProvider } = require('../../../utils/MetroInfoProvider');

module.exports = {
  execute: async (ctx) => {
    const args = ctx.message.text.split(' ').slice(1);
    if (args.length < 2) {
      return ctx.reply('Por favor, especifica el tipo de búsqueda y el término a buscar. Ejemplo: /buscar comercio "nombre del comercio"');
    }

    const searchType = args[0].toLowerCase();
    const query = args.slice(1).join(' ');

    const metroInfoProvider = MetroInfoProvider.getInstance();
    const searchCore = new SearchCore('station');
    searchCore.setDataSource(metroInfoProvider.getFullData());

    let results;
    if (searchType === 'comercio') {
      results = await searchCore.search(query, { commerceFilter: query });
    } else {
      return ctx.reply('Tipo de búsqueda no válido. Tipos válidos: comercio.');
    }

    if (!results || results.length === 0) {
      return ctx.reply(`🔍 No se encontraron estaciones con ${searchType} relacionado a "${query}"`);
    }

    const allResults = results.map(station => ({
      id: station.id,
      name: station.displayName,
      line: station.line.id.toUpperCase(),
    }));

    let response = `**Resultados para "${query}":**\n\n`;
    allResults.forEach(result => {
      response += `- **${result.name}** (Línea ${result.line})\n`;
    });

    await ctx.replyWithMarkdown(response);
  },
  description: 'Busca estaciones por diferentes criterios.',
};
