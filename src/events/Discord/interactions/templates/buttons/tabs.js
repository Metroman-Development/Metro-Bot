const { ActionRowBuilder, ButtonBuilder } = require('discord.js');

module.exports = {
    create(config) {
        return {
            customId: `${config.idPrefix}_tab`,
            async execute(interaction) {
                const [_, tabId] = interaction.customId.split('_');
                
                // 1. Fetch tab-specific data
                const tabData = await config.fetchTabData(tabId);
                
                // 2. Rebuild buttons with active state
                const buttons = config.tabs.map(tab => 
                    new ButtonBuilder()
                        .setCustomId(`${config.idPrefix}_tab_${tab.id}`)
                        .setLabel(tab.label)
                        .setStyle(tab.id === tabId ? ButtonStyle.Success : ButtonStyle.Secondary)
                );

                // 3. Update message
                await interaction.update({
                    embeds: [config.buildEmbed(tabData)],
                    components: [new ActionRowBuilder().addComponents(buttons)]
                });
            }
        };
    }
};