// Versión nueva (/buttons/transport/intermodal.js)
const { TabsTemplate } = require('../../templates/tabs');

module.exports = TabsTemplate.create({
    idPrefix: 'intermodal',
    tabs: [
        { id: 'info', label: 'Información', emoji: 'ℹ️' },
        { id: 'routes', label: 'Recorridos', emoji: '🔄' }
    ],
    async fetchTabData(tabId, interaction) {
        return IntermodalManager.getData(
            tabId, 
            interaction.customId.split('_')[3] // stationId
        );
    }
});