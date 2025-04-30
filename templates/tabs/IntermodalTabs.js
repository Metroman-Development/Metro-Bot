// templates/tabs/IntermodalTabs.js
const { TabsTemplate } = require('./tabs');
const StatusEmbed = require('../embeds/StatusEmbed');

class IntermodalTabs extends TabsTemplate {
    static create() {
        return {
            idPrefix: 'intermodal',
            tabs: [
                { id: 'info', label: 'Información', emoji: 'ℹ️', style: ButtonStyle.Primary },
                { id: 'routes', label: 'Recorridos', emoji: '🔄', style: ButtonStyle.Success }
            ],
            async fetchTabData(tabId, interaction) {
                const [_, __, userId, interactionId] = interaction.customId.split('_');
                const cachedData = await CacheManager.get(`intermodal_${userId}_${interactionId}`);
                
                return {
                    tabId,
                    stationData: cachedData,
                    page: parseInt(interaction.customId.split('_')[4] || 0)
                };
            },
            buildEmbed: (tabData) => {
                const embed = new StatusEmbed();
                return tabData.tabId === 'info' 
                    ? embed._createMainEmbed(tabData.stationData)
                    : embed._createRoutesEmbed(tabData.stationData, tabData.page);
            },
            buildComponents: (tabData, interaction) => {
                const rows = [];
                
                // Main tab row
                rows.push(super.createTabRow(tabData.tabId));
                
                // Pagination row for routes
                if (tabData.tabId === 'routes') {
                    rows.push(this._createPaginationRow(
                        tabData.stationData.Recorridos?.length || 0,
                        tabData.page,
                        interaction
                    ));
                }
                
                return rows;
            },
            _createPaginationRow(totalItems, currentPage, interaction) {
                const totalPages = Math.ceil(totalItems / 10);
                const [_, __, userId, interactionId] = interaction.customId.split('_');
                
                return new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`intermodal_routes_${userId}_${interactionId}_${currentPage - 1}`)
                        .setLabel('◀️')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(currentPage <= 0),
                    new ButtonBuilder()
                        .setCustomId(`intermodal_routes_${userId}_${interactionId}_${currentPage + 1}`)
                        .setLabel('▶️')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(currentPage >= totalPages - 1)
                );
            }
        };
    }
}

module.exports = IntermodalTabs;