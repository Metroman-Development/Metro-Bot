const BaseButton = require('./baseButton');
const { ButtonStyle } = require('discord.js');

class ToggleButton extends BaseButton {
    constructor(options = {}) {
        super({
            customIdPrefix: 'toggleBtn',
            style: ButtonStyle.Secondary,
            ...options
        });
        this.states = new Map(); // userId -> currentState
        this.stateConfig = {
            true: {
                style: ButtonStyle.Success,
                label: 'ON',
                emoji: '✅'
            },
            false: {
                style: ButtonStyle.Danger,
                label: 'OFF',
                emoji: '❌'
            },
            ...options.stateConfig
        };
    }

    async build(userId, initialState = false, customMetadata = {}) {
        this.states.set(userId, initialState);
        return super.build({ 
            userId,
            ...customMetadata 
        }, this.getStateLabel(initialState));
    }

    async handleInteraction(interaction, metadata) {
        const currentState = this.states.get(metadata.userId);
        const newState = !currentState;
        
        // Update state
        this.states.set(metadata.userId, newState);
        
        // Update button appearance
        const updatedButton = ButtonBuilder.from(interaction.component)
            .setLabel(this.getStateLabel(newState))
            .setStyle(this.stateConfig[newState].style)
            .setEmoji(this.stateConfig[newState].emoji);
        
        await interaction.update({
            components: [new ActionRowBuilder().addComponents(updatedButton)]
        });
        
        // Handle business logic
        await this.handleToggle(interaction, newState, metadata);
    }

    getStateLabel(state) {
        return `${this.stateConfig[state].label}`;
    }

    async handleToggle(interaction, newState, metadata) {
        /* Override in child classes */
    }
}

module.exports = ToggleButton;