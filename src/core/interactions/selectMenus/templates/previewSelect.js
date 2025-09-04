const { StringSelectMenuBuilder } = require('discord.js');

class PreviewSelectMenu {
    constructor(options = {}) {

        this.name="PreviewSelect"; 
        this.customId = 'previewSelect';
        this.placeholder = options.placeholder || 'Select an option...';
        this.options = options.options || [];
        this.previews = options.previews || {};
    }

    build() {
        return new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId(this.customId)
                .setPlaceholder(this.placeholder)
                .addOptions(this.options)
        );
    }

    async execute(interaction) {
        const selected = interaction.values[0];
        await interaction.reply({
            content: this.previews[selected] || 'No preview available'
        });
        
        // Keep the menu active
        await interaction.editReply({ components: [this.build()] });
    }
}

module.exports=PreviewSelectMenu;