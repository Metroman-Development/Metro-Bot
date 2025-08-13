// buttons/transport/stationTabs.js
const { TabsTemplate } = require('../../templates/buttons/tabs.js');
const { createGeneralStationInfo, createStationSurroundings } = require('../../../../../config/defaultEmbeds/stationInfoEmbed.js');

module.exports = TabsTemplate.create({
    idPrefix: 'station',
    tabs: [
        { id: 'main', label: 'General', emoji: 'ℹ️' },
        { id: 'surround', label: 'Surroundings', emoji: '🗺️' },
        { id: 'transfer', label: 'Transfer', emoji: '🔀' }
    ],
    async fetchTabData(tabId, interaction) {
        const [,, userId, interactionId] = interaction.customId.split('_');
        return CacheManager.get(`${userId}_${interactionId}`);
    },
    async buildEmbed(tabId, data, interaction) {
        if (tabId === 'transfer') {
            const transferStation = getStationDetails(data.transfer);
            if (!transferStation) throw new Error('Transfer station not found');
            return createGeneralStationInfo(transferStation);
        }
        
        return tabId === 'surround' 
            ? createStationSurroundings(data)
            : createGeneralStationInfo(data);
    }
});