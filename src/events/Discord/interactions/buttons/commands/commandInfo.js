// Versión nueva (/buttons/commands/commandInfo.js)
// TODO: This file is causing a "CommandModel is not defined" error.
// This feature seems to be unfinished. Commenting out for now.
/*
const { EmbedBuilder } = require('discord.js');
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
*/
module.exports = {};