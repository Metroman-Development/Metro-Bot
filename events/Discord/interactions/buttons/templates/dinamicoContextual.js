const { ButtonBuilder, ActionRowBuilder } = require('discord.js');

module.exports = {
    customId: 'ctx_', // Prefijo contextual
    
    /**
     * @param {ButtonInteraction} interaction 
     * @param {Client} client
     * @param {Object} contextData - Datos del comando inicial
     */
    async execute(interaction, client, contextData) {
        const [_, action, commandId, userId] = interaction.customId.split('_');
        
        // 1. Obtener configuración basada en el comando original
        const config = getCommandConfig(commandId); // Tu función personalizada
        
        // 2. Generar respuesta dinámica
        const response = this.generateResponse(
            action, 
            userId, 
            contextData, // Datos pasados desde el comando
            config
        );

        // 3. Actualizar interacción
        await interaction.update(response);
    },

    generateResponse(action, userId, context, config) {
        // Ejemplo: Personalizar por tipo de comando
        switch(context.commandType) {
            case 'moderacion':
                return this._generateModResponse(action, context);
            case 'juegos':
                return this._generateGameResponse(action, context);
            default:
                return this._defaultResponse(action, userId);
        }
    },

    _generateModResponse(action, context) {
        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`ctx_${action}_mod_${context.targetId}`)
                .setLabel(action === 'ban' ? '🔨 Banear' : '⚠️ Advertir')
                .setStyle(action === 'ban' ? ButtonStyle.Danger : ButtonStyle.Primary)
        );

        return {
            content: `Acción: ${action} para ${context.targetUser}`,
            components: [buttons]
        };
    }
};