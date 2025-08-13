// buttons/info/serverTabs.js
// buttons/info/serverTabs.js
const { TabsTemplate } = require('../../templates/buttons/tabs.js');
const ServerInfoEmbed = require('../../../templates/embeds/ServerInfoEmbed.js');
const { CacheManager } = require('../../../../../core/cache/CacheManager.js');

module.exports = TabsTemplate.create({
    idPrefix: 'server',
    maxTabsPerRow: 3,
    tabs: [
        { 
            id: 'main', 
            label: 'Principal', 
            emoji: '🏠',
            description: 'Vista general del servidor'
        },
        { 
            id: 'channels', 
            label: 'Canales', 
            emoji: '💬',
            description: 'Lista de canales del servidor'
        },
        { 
            id: 'roles', 
            label: 'Roles', 
            emoji: '🎭',
            description: 'Lista de roles del servidor'
        },
        { 
            id: 'emojis', 
            label: 'Emojis', 
            emoji: '😀',
            description: 'Lista de emojis del servidor'
        },
        { 
            id: 'features', 
            label: 'Características', 
            emoji: '✨',
            description: 'Características especiales del servidor'
        }
    ],

    async fetchTabData(tabId, interaction) {
        // Extract interaction context from customId
        const [,, userId, interactionId] = interaction.customId.split('_');
        
        // Use CacheManager to get cached data with proper namespace
        const cachedData = await CacheManager.get(
            'interaction:serverinfo',  // namespace
            `${userId}_${interactionId}` // key
        );

        if (!cachedData) {
            throw new Error('Session expired or invalid cache key');
        }

        // Enrich with fresh guild data if needed
        return {
            ...cachedData,
            guild: interaction.guild,
            currentTab: tabId,
            lastAccessed: new Date()
        };
    },

    buildEmbed(tabId, data) {
        const embedBuilder = new ServerInfoEmbed();
        
        switch(tabId) {
            case 'channels':
                return embedBuilder.createChannelsEmbed(data);
            case 'roles':
                return embedBuilder.createRolesEmbed(data);
            case 'emojis':
                return embedBuilder.createEmojisEmbed(data);
            case 'features':
                return embedBuilder.createFeaturesEmbed(data);
            default:
                return embedBuilder.createMainEmbed(data);
        }
    },

    async onTabChange(interaction, tabId, cachedData) {
        // Update cache with new tab selection
        await CacheManager.set(
            'interaction:serverinfo',
            `${interaction.user.id}_${interaction.id}`,
            {
                ...cachedData,
                currentTab: tabId,
                lastAccessed: new Date()
            },
            300_000 // 5 minute TTL
        );
    },

    createTabButtons(currentTabId, interaction) {
        const rows = [];
        let currentRow = [];
        
        this.tabs.forEach(tab => {
            if (currentRow.length === this.maxTabsPerRow) {
                rows.push(currentRow);
                currentRow = [];
            }
            
            if (tab.id !== currentTabId) {
                currentRow.push({
                    customId: `${this.idPrefix}_${tab.id}_${interaction.user.id}_${interaction.id}`,
                    label: tab.label,
                    emoji: tab.emoji,
                    style: tab.id === currentTabId ? 'PRIMARY' : 'SECONDARY',
                    disabled: tab.id === currentTabId
                });
            }
        });

        if (currentRow.length > 0) {
            rows.push(currentRow);
        }

        return rows;
    }
});