const { ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder } = require('discord.js');

class FlexibleSelector {
    /**
     * @param {Object} config
     * @param {String} config.idPrefix - Prefijo para IDs (ej: 'station_select')
     * @param {Function} config.fetchOptions - Async fn() => [{label, value, description?, emoji?}]
     * @param {Function} config.onSelect - Async fn(interaction, selectedValue, context)
     * @param {String} [config.style='menu'] - 'menu' | 'buttons' | 'tabs'
     * @param {Number} [config.maxOptions=25] - Máximo opciones para menús
     */
    static create(config) {
        return {
            customId: `${config.idPrefix}_flex`,
            async execute(interaction, client) {
                // 1. Obtener contexto
                const context = {
                    userId: interaction.user.id,
                    guildId: interaction.guild?.id,
                    messageId: interaction.message?.id
                };

                // 2. Manejar diferentes estilos
                switch(config.style) {
                    case 'menu':
                        await this._handleMenu(interaction, config, context);
                        break;
                    case 'buttons':
                        await this._handleButtons(interaction, config, context);
                        break;
                    case 'tabs':
                        await this._handleTabs(interaction, config, context);
                        break;
                }
            },

            async _handleMenu(interaction, config, context) {
                const options = await config.fetchOptions(context);
                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId(`${config.idPrefix}_menu`)
                    .setPlaceholder(config.placeholder || 'Selecciona una opción')
                    .addOptions(options.slice(0, config.maxOptions));

                await interaction.reply({
                    components: [new ActionRowBuilder().addComponents(selectMenu)],
                    ephemeral: config.ephemeral || false
                });
            },

            async _handleButtons(interaction, config, context) {
                const options = await config.fetchOptions(context);
                const rows = this._chunkArray(options, 5).map(group => {
                    return new ActionRowBuilder().addComponents(
                        group.map(opt => 
                            new ButtonBuilder()
                                .setCustomId(`${config.idPrefix}_btn_${opt.value}`)
                                .setLabel(opt.label)
                                .setStyle(config.buttonStyle || ButtonStyle.Primary)
                                .setEmoji(opt.emoji || '')
                        )
                    );
                });

                await interaction.reply({
                    content: config.prompt || 'Elige una opción:',
                    components: rows,
                    ephemeral: config.ephemeral || false
                });
            },

            async _handleTabs(interaction, config, context) {
                // Implementación para pestañas (ej: info/recorridos/horarios)
                const tabs = await config.fetchTabs(context);
                const row = new ActionRowBuilder().addComponents(
                    tabs.map(tab => 
                        new ButtonBuilder()
                            .setCustomId(`${config.idPrefix}_tab_${tab.id}`)
                            .setLabel(tab.label)
                            .setStyle(ButtonStyle.Secondary)
                            .setEmoji(tab.emoji || '')
                    )
                );

                const initialTab = tabs[0];
                await interaction.reply({
                    embeds: [await config.buildTabEmbed(initialTab, context)],
                    components: [row]
                });
            },

            _chunkArray(arr, size) {
                return Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
                    arr.slice(i * size, i * size + size)
                );
            }
        };
    }
}

module.exports = FlexibleSelector;