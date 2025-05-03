const { ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');

class SelectionTemplate {
    static create(config) {
        return {
            customId: `${config.idPrefix}_sel`,
            async execute(interaction) {
                const options = await config.fetchOptions();
                const menu = new StringSelectMenuBuilder()
                    .setCustomId(`${config.idPrefix}_menu`)
                    .setPlaceholder(config.placeholder || 'Select...')
                    .addOptions(options);

                await interaction.reply({
                    components: [new ActionRowBuilder().addComponents(menu)],
                    ephemeral: true
                });
            }
        };
    }
}

module.exports = SelectionTemplate;