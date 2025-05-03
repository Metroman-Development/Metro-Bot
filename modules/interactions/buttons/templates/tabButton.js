const { ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const BaseButton = require('./baseButton');

class TabButton extends BaseButton {
    constructor(options = {}) {
        super({
            customIdPrefix: 'tabBtn',
            style: ButtonStyle.Secondary,
            ...options
        });
        this.activeStyle = options.activeStyle || ButtonStyle.Primary;
        this.inactiveStyle = options.inactiveStyle || ButtonStyle.Secondary;
        this.activeTabs = new Map(); // userId -> activeTabId
    }

    async buildTabRow(userId, tabs, activeTabId) {
        this.activeTabs.set(userId, activeTabId);
        
        const buttons = tabs.map(tab => 
            new ButtonBuilder()
                .setCustomId(this.generateCustomId({
                    tabId: tab.id,
                    userId // Critical for validation
                }))
                .setLabel(tab.label)
                .setStyle(tab.id === activeTabId ? this.activeStyle : this.inactiveStyle)
                .setDisabled(tab.id === activeTabId)
        );

        return new ActionRowBuilder().addComponents(buttons);
    }

    async handleInteraction(interaction, metadata) {
        // Validate tab owner
        if (metadata.userId !== interaction.user.id) {
            return interaction.reply({
                content: "You can't control these tabs",
                ephemeral: true
            });
        }

        // Update active tab
        this.activeTabs.set(interaction.user.id, metadata.tabId);
        
        // Return control to parent
        return { 
            newTab: metadata.tabId,
            userId: interaction.user.id 
        };
    }
}

module.exports = TabButton;