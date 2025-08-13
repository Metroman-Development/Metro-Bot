const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

class PaginationTemplate {
    static create(config) {
        return {
            customId: `${config.idPrefix}_pag`,
            async execute(interaction) {
                const [_, action, userId, page] = interaction.customId.split('_');
                const currentPage = parseInt(page) || 0;
                
                const newPage = action === 'next' ? currentPage + 1 : Math.max(0, currentPage - 1);
                const data = await config.fetchData(newPage);

                await interaction.update({
                    embeds: [config.buildEmbed(data, newPage)],
                    components: [this._buildButtons(config.idPrefix, userId, newPage, data.totalPages)]
                });
            },
            _buildButtons(prefix, userId, currentPage, totalPages) {
                return new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`${prefix}_prev_${userId}_${currentPage}`)
                        .setLabel('◀')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(currentPage <= 0),
                    new ButtonBuilder()
                        .setCustomId(`${prefix}_next_${userId}_${currentPage}`)
                        .setLabel('▶')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(currentPage >= totalPages - 1)
                );
            }
        };
    }
}

module.exports = PaginationTemplate;