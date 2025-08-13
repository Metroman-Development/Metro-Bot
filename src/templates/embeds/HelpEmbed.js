// templates/embeds/HelpEmbed.js
const BaseEmbed = require('./baseEmbed');

class HelpEmbed extends BaseEmbed {
    generateInitial(categories, userId, interactionId) {
        return {
            embed: this.createEmbed({
                title: '📚 **Centro de Ayuda**',
                description: this._buildInitialDescription(categories),
                color: '#2196F3'
            }),
            components: [this._createCategoryMenu(userId, interactionId, categories)]
        };
    }

    generateCommand(command, userId, interactionId) {
        return {
            embed: this.createEmbed({
                title: `📄 **/${command.name}**`,
                description: command.description || 'No hay descripción disponible.',
                fields: this._buildCommandFields(command),
                color: '#4CAF50'
            }),
            components: [this._createBackButton(userId, interactionId)]
        };
    }

    generateCategory(category, commands, userId, interactionId) {
        return {
            embed: this.createEmbed({
                title: `📂 **Categoría: ${category}**`,
                description: 'Aquí tienes los comandos disponibles:',
                fields: this._buildCommandListFields(commands),
                color: '#2196F3'
            }),
            components: [
                ...this._createCommandButtons(commands, userId, interactionId),
                this._createBackButton(userId, interactionId)
            ]
        };
    }

    // Private helper methods...
    _buildInitialDescription(categories) {
        return '¡Bienvenido al centro de ayuda! Selecciona una categoría para ver los comandos disponibles.\n\n' +
               `**Categorías disponibles:** ${Object.keys(categories).join(', ')}`;
    }

    _buildCommandFields(command) {
        return [
            { name: '📂 **Categoría**', value: command.category || 'General', inline: true },
            { name: '🛠️ **Uso**', value: `\`${command.usage || `/${command.name}`}\``, inline: true },
            { name: '🔐 **Permisos**', value: command.permissions?.join(', ') || 'Ninguno', inline: false }
        ];
    }

    _createCategoryMenu(userId, interactionId, categories) {
        return new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId(`helpCategory_${userId}_${interactionId}`)
                .setPlaceholder('📂 Selecciona una categoría')
                .addOptions(Object.keys(categories).map(category => ({
                    label: category,
                    description: `📄 Ver comandos de ${category}`,
                    value: category,
                }))
        )
     ) 
    }

    _createBackButton(userId, interactionId) {
        return new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`ayudaGoBack_${userId}_${interactionId}`)
                .setLabel('🔙 Volver')
                .setStyle(ButtonStyle.Secondary)
        );
    }
}

module.exports = HelpEmbed;