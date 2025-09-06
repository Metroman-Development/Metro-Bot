const TimeHelpers = require('../../../utils/timeHelpers');
const { MetroInfoProvider } = require('../../../utils/MetroInfoProvider');

module.exports = {
  execute: async (ctx) => {
    const args = ctx.message.text.split(' ').slice(1);
    const viewType = args[0] || 'actual';

    if (viewType === 'actual') {
      const metroInfoProvider = MetroInfoProvider.getInstance();
      const metroData = metroInfoProvider.getFullData();
      const networkStatus = metroData.network_status;
      const timeHelper = new TimeHelpers();
      const currentPeriod = timeHelper.getCurrentPeriod();
      const isExpressActive = TimeHelpers.isExpressActive();
      const operatingHours = timeHelper.getOperatingHours();

      const response = `
**Estado Actual del Servicio**
**Estado General:** ${networkStatus.status || 'Desconocido'}
📝 ${networkStatus.summary?.es?.resumen || 'Sin información adicional'}

⏰ **Período Tarifario:** ${currentPeriod.name}
🚄 **Servicio Expreso:** ${isExpressActive ? 'ACTIVO' : 'No activo'}
🕒 **Horario:** ${operatingHours.opening} - ${operatingHours.closing}${operatingHours.isExtended ? ` (Extendido)` : ''}
      `;

      await ctx.replyWithMarkdown(response);
    } else {
      await ctx.reply('Vista de servicio no válida. Tipos válidos: actual.');
    }
  },
  description: 'Muestra información sobre el servicio de Metro.',
};
