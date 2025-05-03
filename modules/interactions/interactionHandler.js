const { readdirSync, statSync } = require('fs');
const { join, parse } = require('path');
const { Collection, MessageFlags } = require('discord.js');
const logger = require('../../events/logger');

class InteractionHandler {
    constructor() {
        this.components = {
            buttons: new Collection(),
            selectMenus: new Collection(),
            modals: new Collection(),
            contextMenus: new Collection()
        };
        
        this._loadTemplates();
        this._startCleanupInterval();
    }

    // ======================
    // TEMPLATE LOADING
    // ======================
    _loadTemplates() {
        this._loadButtonTemplates();
        // Load other template types as needed...
    }

    _loadButtonTemplates() {
        const templatesPath = join(__dirname, 'buttons');
        
        try {
            // Verify templates directory exists
            if (!statSync(templatesPath).isDirectory()) {
                throw new Error(`Button templates directory not found at: ${templatesPath}`);
            }

            // Load all JavaScript files except BaseButton.js
            readdirSync(templatesPath)
                .filter(file => file.endsWith('.js') 
                        )
                .forEach(file => {
                    try {
                        const templatePath = join(templatesPath, file);
                        const TemplateClass = require(templatePath);
                        
                        // Validate template class
                        if (typeof TemplateClass.prototype.execute !== 'function') {
                            throw new Error(`Missing required execute() method in ${file}`);
                        }

                        const instance = new TemplateClass();
                        this.components.buttons.set(instance.constructor.name, instance);
                        
                        logger.debug(`Registered button template: ${instance.constructor.name}`, {
                            prefix: instance.customIdPrefix,
                            path: templatePath
                        });

                    } catch (error) {
                        logger.error(`Failed to load button template ${file}:`, error);
                    }
                });

            // Debug output
            logger.info(`Loaded ${this.components.buttons.size} button templates`, {
                prefixes: [...this.components.buttons.values()].map(b => b.customIdPrefix)
            });

        } catch (error) {
            logger.error('Button template loading failed:', error);
            throw error; // Fail fast if templates can't be loaded
        }
    }

    // ======================
    // INTERACTION HANDLING
    // ======================
    async execute(interaction) {
        try {
            if (interaction.isButton()) return this._handleButton(interaction);
            if (interaction.isAnySelectMenu()) return this._handleSelectMenu(interaction);
            if (interaction.isModalSubmit()) return this._handleModal(interaction);
            if (interaction.isContextMenuCommand()) return this._handleContextMenu(interaction);

            logger.warn('Unknown interaction type:', { type: interaction.type });
            return this._sendUnknownInteractionResponse(interaction);

        } catch (error) {
            logger.error('Interaction processing failed:', {
                customId: interaction.customId,
                error: error.stack
            });
            return this._sendErrorResponse(interaction, error);
        }
    }

    async _handleButton(interaction) {
        // Get all possible prefixes from customId parts
        const possiblePrefixes = interaction.customId.split(':');
        
        // Find first matching template
        const template = [...this.components.buttons.values()].find(btn => 
            possiblePrefixes.includes(btn.customIdPrefix)
        );

        if (!template) {
            logger.warn('Unknown button interaction:', {
                customId: interaction.customId,
                availablePrefixes: [...this.components.buttons.values()].map(b => b.customIdPrefix)
            });
            return this._sendUnknownInteractionResponse(interaction);
        }

        logger.debug('Executing button template:', {
            template: template.constructor.name,
            customId: interaction.customId
        });

        await template.execute(interaction);
        
        return
    }

    // ... (other interaction handlers remain similar)

    // ======================
    // RESPONSE HANDLING
    // ======================
    async _sendUnknownInteractionResponse(interaction) {
        const response = {
            content: '⚠️ This interaction is no longer available',
            flags: MessageFlags.FLAGS.EPHEMERAL
        };

        if (interaction.deferred || interaction.replied) {
            return interaction.editReply(response);
        }
        return interaction.reply(response);
    }

    async _sendErrorResponse(interaction, error) {
        const errorId = Date.now().toString(36);
        logger.error(`Interaction Error [${errorId}]:`, error);

        const response = {
            content: `❌ An error occurred (ID: ${errorId})`,
            flags: MessageFlags.FLAGS.EPHEMERAL
        };

        if (interaction.deferred || interaction.replied) {
            return interaction.followUp(response);
        }
        return interaction.reply(response);
    }

    // ======================
    // MAINTENANCE
    // ======================
    _startCleanupInterval(interval = 3600000) {
        setInterval(() => this._cleanupExpiredInteractions(), interval);
        logger.debug(`Started cleanup interval (every ${interval/1000}s)`);
    }

    _cleanupExpiredInteractions() {
        logger.debug('Running interaction state cleanup');
        // Implement cleanup logic if needed
    }

    // ======================
    // PUBLIC API
    // ======================
    reloadTemplates() {
        this.components.buttons.clear();
        this._loadButtonTemplates();
        logger.info('Button templates reloaded');
    }
}

module.exports = new InteractionHandler() ;