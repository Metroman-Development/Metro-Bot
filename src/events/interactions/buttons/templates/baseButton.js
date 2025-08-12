const { ButtonBuilder, ActionRowBuilder } = require('discord.js');
const cacheManager = require('../../../utils/cacheManager');

class BaseButton {
    constructor(config = {}) {
        // Configuration options
        this.customIdPrefix = config.customIdPrefix || 'btn';
        this.requiresDefer = config.requiresDefer ?? true;
        this.ephemeral = config.ephemeral ?? false;
        this.cooldown = config.cooldown ?? 0;
        this.style = config.style || ButtonStyle.Primary;
    }

    // ======================
    // CUSTOM ID MANAGEMENT
    // ======================
    
    /**
     * Generates a custom ID with metadata
     * @param {Object} metadata - Data to store in the customId
     * @returns {string} Formatted customId string
     */
    generateCustomId(metadata = {}) {
        return `${this.customIdPrefix}:${JSON.stringify(metadata)}`;
    }

    /**
     * Parses a custom ID into its components
     * @param {string} customId 
     * @returns {Object|null} Parsed data or null if invalid
     */
    parseCustomId(customId) {
        const [prefix, data] = customId.split(':');
    //   if (prefix !== this.customIdPrefix) return null;
        
        try {
            return data;
        } catch {
            return null;
        }
    }

    /**
     * Checks if this template should handle the interaction
     * @param {string} customId 
     * @returns {boolean}
     */
    matchesCustomId(customId) {
        const parts = customId.split(':');
        return parts.includes(this.customIdPrefix);
    } 

    // ======================
    // CORE FUNCTIONALITY
    // ======================

    /**
     * Main execution entry point for button interactions
     * @param {ButtonInteraction} interaction 
     * @returns {Promise<void>}
     */
    async execute(interaction) {
        try {
            // Defer if configured
           
            if (!interaction) {
                
                return
               } 
            
            if (!interaction.deferred&&!interaction.replied) {
                await interaction.deferUpdate() ;
                
                    
                    
            }

            // Parse metadata from customId
            const metadata = this.parseCustomId(interaction.customId);
            if (!metadata) {
                return this.handleInvalidInteraction(interaction);
            }

            // Handle cooldowns if configured
            if (this.cooldown > 0) {
                const cooldownKey = `cooldown_${interaction.user.id}_${this.customIdPrefix}`;
                if (cacheManager.has(cooldownKey)) {
                    return this.handleCooldown(interaction);
                }
                cacheManager.set(cooldownKey, true, this.cooldown);
            }

            // Process the interaction
            await this.handleInteraction(interaction, metadata);
            
            return
            
        } catch (error) {
            console.error(`[${this.constructor.name}] Execution error:`, error);
            return this.handleError(interaction, error);
        }
    }

    // ======================
    // INTERACTION HANDLERS
    // ======================

    /**
     * Process the button interaction (must be implemented by child classes)
     * @param {ButtonInteraction} interaction 
     * @param {Object} metadata 
     */
    async handleInteraction(interaction, metadata) {
        throw new Error('handleInteraction() must be implemented by child classes');
    }

    /**
     * Handle invalid customId format
     * @param {ButtonInteraction} interaction 
     */
    async handleInvalidInteraction(interaction) {
        await interaction.editReply({
            content: '❌ Invalid button configuration',
            ephemeral: true
        });
    }

    /**
     * Handle when button is on cooldown
     * @param {ButtonInteraction} interaction 
     */
    async handleCooldown(interaction) {
        await interaction.reply({
            content: '⏳ Please wait before using this button again',
            ephemeral: true
        });
    }

    /**
     * Handle execution errors
     * @param {ButtonInteraction} interaction 
     * @param {Error} error 
     */
    async handleError(interaction, error) {
        const errorId = Date.now().toString(36);
        console.error(`[${this.constructor.name}] Error ${errorId}:`, error);

        const response = {
            content: `❌ An error occurred (ID: ${errorId})`,
            ephemeral: true
        };

        if (interaction.deferred || interaction.replied) {
            await interaction.followUp(response);
        } else {
            await interaction.editReply(response);
        }
    }

    // ======================
    // BUILDER METHODS
    // ======================

    /**
     * Create a new button instance
     * @param {Object} options 
     * @param {string} options.label
     * @param {string} options.emoji
     * @param {Object} options.metadata
     * @returns {ButtonBuilder}
     */
    createButton({ label, emoji, metadata = {} }) {
        const button = new ButtonBuilder()
            .setCustomId(this.generateCustomId(metadata))
            .setStyle(this.style);

        if (label) button.setLabel(label);
        if (emoji) button.setEmoji(emoji);

        return button;
    }

    /**
     * Create an action row with buttons
     * @param {Array<ButtonBuilder>} buttons 
     * @returns {ActionRowBuilder}
     */
    createActionRow(buttons = []) {
        return new ActionRowBuilder().addComponents(buttons);
    }
}

module.exports = BaseButton;