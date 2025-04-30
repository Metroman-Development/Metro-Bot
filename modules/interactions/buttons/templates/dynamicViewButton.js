const { ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const BaseButton = require('./baseButton');

class DynamicViewButton extends BaseButton {
    constructor(options = {}) {
        super({
            customIdPrefix: 'dynView',
            style: ButtonStyle.Primary,
            ...options
        });
        
        // View management
        this.views = options.views || []; // Array of { id, label, content }
        this.currentIndex = new Map(); // userId -> index
        this.infoStates = new Map(); // userId -> Map(viewId -> bool)
        
        // Navigation
        this.showNav = options.showNav ?? true;
        this.loopViews = options.loopViews ?? true;
    }

    //=== BUILDER METHODS ===//
    async buildInitialView(userId) {
        this.currentIndex.set(userId, 0);
        return this.createViewComponents(userId);
    }

    createViewComponents(userId) {
        const index = this.currentIndex.get(userId) || 0;
        const view = this.views[index];
        const isInfoShown = this.getInfoState(userId, view.id);
        
        return [
            // Main Content Row
            new ActionRowBuilder().addComponents(
                this.createMainButton(view, isInfoShown)
            ),
            
            // Navigation Row (conditionally shown)
            ...(this.showNav ? [this.createNavRow(userId, index)] : [])
        ];
    }

    createMainButton(view, isInfoShown) {
        return new ButtonBuilder()
            .setCustomId(this.generateCustomId({
                action: 'toggleInfo',
                viewId: view.id
            }))
            .setLabel(isInfoShown ? `Hide ${view.label} Info` : `Show ${view.label} Info`)
            .setStyle(isInfoShown ? ButtonStyle.Success : ButtonStyle.Primary);
    }

    createNavRow(userId, currentIndex) {
        return new ActionRowBuilder().addComponents(
            // Previous Button
            new ButtonBuilder()
                .setCustomId(this.generateCustomId({ action: 'prevView' }))
                .setLabel('◀ Back')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(!this.loopViews && currentIndex === 0),
            
            // Current Position
            new ButtonBuilder()
                .setCustomId('viewPosition')
                .setLabel(`${currentIndex + 1}/${this.views.length}`)
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true),
            
            // Next Button
            new ButtonBuilder()
                .setCustomId(this.generateCustomId({ action: 'nextView' }))
                .setLabel('Next ▶')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(!this.loopViews && currentIndex === this.views.length - 1)
        );
    }

    //=== STATE MANAGEMENT ===//
    getInfoState(userId, viewId) {
        return this.infoStates.get(userId)?.get(viewId) || false;
    }

    setInfoState(userId, viewId, state) {
        if (!this.infoStates.has(userId)) {
            this.infoStates.set(userId, new Map());
        }
        this.infoStates.get(userId).set(viewId, state);
    }

    //=== INTERACTION HANDLING ===//
    async handleInteraction(interaction, metadata) {
        const userId = interaction.user.id;
        let currentIndex = this.currentIndex.get(userId) || 0;
        const currentView = this.views[currentIndex];

        switch (metadata.action) {
            case 'toggleInfo':
                const newState = !this.getInfoState(userId, currentView.id);
                this.setInfoState(userId, currentView.id, newState);
                break;
                
            case 'prevView':
                currentIndex = this.getNewIndex(currentIndex, -1);
                this.currentIndex.set(userId, currentIndex);
                break;
                
            case 'nextView':
                currentIndex = this.getNewIndex(currentIndex, 1);
                this.currentIndex.set(userId, currentIndex);
                break;
        }

        await this.updateView(interaction, userId);
    }

    getNewIndex(current, delta) {
        const newIndex = current + delta;
        if (newIndex < 0) return this.loopViews ? this.views.length - 1 : 0;
        if (newIndex >= this.views.length) return this.loopViews ? 0 : this.views.length - 1;
        return newIndex;
    }

    async updateView(interaction, userId) {
        const index = this.currentIndex.get(userId);
        const view = this.views[index];
        const isInfoShown = this.getInfoState(userId, view.id);

        await interaction.update({
            content: this.formatContent(view, isInfoShown),
            components: this.createViewComponents(userId)
        });
    }

    formatContent(view, isInfoShown) {
        return [
            `**${view.label}**`,
            isInfoShown ? view.content : "*Select 'Show Info' for details*"
        ].join('\n');
    }
}

module.exports = DynamicViewButton;