const DisambiguationCache = require('./utils/DisambiguationCache');
const DisambiguationUI = require('./utils/DisambiguationUI');
const { ActionRowBuilder } = require('discord.js');

class DisambiguationHandler {
    static async create(interaction, query, matches, callback) {
        const sessionId = `disambig:${interaction.user.id}:${interaction.id}`;
        
        await DisambiguationCache.set(sessionId, {
            query,
            matches,
            callback,
            createdAt: Date.now()
        });

        const { embed, components } = DisambiguationUI.create(query, matches);
        
        await interaction.editReply({
            embeds: [embed],
            components: components.map(comp => new ActionRowBuilder().addComponents(comp))
        });
    }

    static async handle(interaction) {
        const [action, sessionId, ...params] = interaction.customId.split(':');
        
        const handler = {
            'select': this._handleSelect,
            'cancel': this._handleCancel
        }[action];

        if (handler) {
            return handler.call(this, interaction, sessionId, ...params);
        }
    }

    static async _handleSelect(interaction, sessionId, selectedIndex) {
        const session = await DisambiguationCache.get(sessionId);

        if (!session || !session.matches[selectedIndex]) {
            return interaction.reply({
                content: '⚠️ Disambiguation session expired or invalid'
            });
        }

        await session.callback(session.matches[selectedIndex]);
        await DisambiguationCache.delete(sessionId);
        await interaction.update({ components: [] });
    }

    static async _handleCancel(interaction, sessionId) {
        await DisambiguationCache.delete(sessionId);
        await interaction.update({
            content: '❌ Operation cancelled',
            components: [],
            embeds: []
        });
    }
}

module.exports = DisambiguationHandler;