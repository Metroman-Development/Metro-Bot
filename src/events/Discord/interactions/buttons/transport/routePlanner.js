// buttons/transport/routePlanner.js
const { TabsTemplate } = require('../../templates/buttons/tabs.js');
const { createRouteEmbed, createSummaryEmbed } = require('../../../../../templates/embeds/planificarEmbed.js');

module.exports = TabsTemplate.create({
    idPrefix: 'route',
    tabs: [
        { id: 'summary', label: 'Summary', emoji: '📊' },
        { id: 'fastest', label: 'Fastest', emoji: '⚡' },
        { id: 'balanced', label: 'Balanced', emoji: '🔄' },
        { id: 'slowest', label: 'Scenic', emoji: '🌄' }
    ],
    async fetchTabData(tabId, interaction) {
        const [,, userId, messageId] = interaction.customId.split('_');
        return CacheManager.get(`${userId}_${messageId}`);
    },
    buildEmbed(tabId, data) {
        if (tabId === 'summary') return createSummaryEmbed(data);
        
        const routeIndex = { fastest: 0, balanced: 1, slowest: 2 }[tabId];
        return createRouteEmbed(data.routes[routeIndex], data);
    }
});