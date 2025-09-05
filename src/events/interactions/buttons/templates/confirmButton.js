const BaseButton = require('./baseButton');
const { ButtonStyle } = require('discord.js');

class ConfirmButton extends BaseButton {
    constructor(options = {}) {
        super({
            customIdPrefix: 'confirmBtn',
            style: options.confirmStyle || ButtonStyle.Success,
            ...options
        });
        this.cancelStyle = options.cancelStyle || ButtonStyle.Danger;
        this.timeout = options.timeout || 300_000; // 5 minutes
    }

    async buildConfirmation(userId, actionMetadata) {
        return [
            new ActionRowBuilder().addComponents([
                new ButtonBuilder()
                    .setCustomId(this.generateCustomId({
                        action: 'confirm',
                        userId,
                        ...actionMetadata
                    }))
                    .setLabel('Confirm')
                    .setStyle(this.style),
                new ButtonBuilder()
                    .setCustomId(this.generateCustomId({
                        action: 'cancel',
                        userId,
                        ...actionMetadata
                    }))
                    .setLabel('Cancel')
                    .setStyle(this.cancelStyle)
            ])
        ];
    }

    async handleInteraction(interaction, metadata) {
        if (metadata.action === 'confirm') {
            await this.handleConfirm(interaction, metadata);
        } else {
            await this.handleCancel(interaction, metadata);
        }
        
        // Disable buttons after action
        await interaction.update({
            components: interaction.message.components.map(row => 
                new ActionRowBuilder().addComponents(
                    row.components.map(btn => 
                        ButtonBuilder.from(btn).setDisabled(true)
                    )
                )
            )
        });
    }

    async handleConfirm(interaction, metadata) {
        /* Override in child classes */
    }

    async handleCancel(interaction, metadata) {
        await interaction.followUp({
            content: 'Action cancelled'
        });
    }
}

module.exports = ConfirmButton;