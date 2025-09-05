const { ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const BaseButton = require('./baseButton');


class SingleSelectButton extends BaseButton {
    constructor(options = {}) {
        super({
            customIdPrefix: 'singleSelect',
            style: ButtonStyle.Secondary,
            ...options
        });
        
        // Selection options
        this.options = options.options || []; // Array of { id, label }
        this.selectedStyle = options.selectedStyle || ButtonStyle.Success;
        this.deselectedStyle = options.deselectedStyle || ButtonStyle.Secondary;
        
        // State tracking
        this.selections = new Map(); // userId -> selectedId
    }

    //=== BUILDER METHODS ===//
    async buildSelectionMenu(userId) {
        return new ActionRowBuilder().addComponents(
            this.options.map(option => 
                this.createOptionButton(userId, option)
       ));
    }

    createOptionButton(userId, option) {
        const isSelected = this.selections.get(userId) === option.id;
        
        return new ButtonBuilder()
            .setCustomId(this.generateCustomId({
                action: 'select',
                optionId: option.id
            }))
            .setLabel(option.label)
            .setStyle(isSelected ? this.selectedStyle : this.deselectedStyle)
            .setEmoji(isSelected ? '✅' : '');
    }

    //=== INTERACTION HANDLING ===//
    async handleInteraction(interaction, metadata) {
        const userId = interaction.user.id;
        
        if (metadata.action === 'select') {
            // Update selection
            this.selections.set(userId, metadata.optionId);
            
            // Refresh view
            await interaction.update({
                components: [await this.buildSelectionMenu(userId)]
            });
            
            // Handle the selection
            await this.handleSelection(
                interaction, 
                metadata.optionId
            );
        }
    }

    async handleSelection(interaction, selectedId) {
        /* Override in child classes */
        const selectedOption = this.options.find(opt => opt.id === selectedId);
        await interaction.followUp({
            content: `You selected: ${selectedOption.label}`
        });
    }
}

module.exports = SingleSelectButton;