const { EmbedBuilder } = require('discord.js');

class EmbedPaginator {
    constructor(embeds = []) {
        this.embeds = embeds;
        this.currentIndex = new Map(); // userId -> index
    }

    async start(userId, interaction) {
        this.currentIndex.set(userId, 0);
        await this.showPage(userId, interaction);
    }

    async showPage(userId, interaction) {
        const index = this.currentIndex.get(userId) || 0;
        const embed = this.embeds[index];

        await interaction.reply({
            embeds: [embed],
            components: [this.createControls(userId)]
        });
    }

    createControls(userId) {
        const index = this.currentIndex.get(userId) || 0;
        
        return new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('paginator_prev')
                .setLabel('◀')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(index === 0),
                
            new ButtonBuilder()
                .setCustomId('paginator_next')
                .setLabel('▶')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(index === this.embeds.length - 1)
        );
    }

    async handleInteraction(interaction) {
        const userId = interaction.user.id;
        let index = this.currentIndex.get(userId) || 0;

        if (interaction.customId === 'paginator_prev') index--;
        if (interaction.customId === 'paginator_next') index++;

        this.currentIndex.set(userId, index);
        await interaction.update({
            embeds: [this.embeds[index]],
            components: [this.createControls(userId)]
        });
    }
}

module.exports=EmbedPaginator;