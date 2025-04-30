// Versión nueva (/buttons/commands/commandInfo.js)
const { NavigationTemplate } = require('../../templates/navigation');

module.exports = NavigationTemplate.create({
    idPrefix: 'cmd_info',
    validateUser: true, // Auto-verifica owner del botón
    async fetchState(contextId) {
        return {
            command: await CommandModel.get(contextId),
            history: [] // Opcional para navegación
        };
    },
    buildEmbed(data) {
        return new EmbedBuilder()
            .setTitle(`Info: ${data.command.name}`)
            .addFields(
                { name: 'Uso', value: data.command.usage }
            );
    }
});