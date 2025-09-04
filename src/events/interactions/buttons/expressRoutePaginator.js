const { getExpressRoutePage } = require('../../../utils/expressRoutes');

module.exports = {
    customIdPrefix: 'express_route_page',

    /**
     * Handles the pagination for express route stations.
     * @param {import('discord.js').ButtonInteraction} interaction The button interaction.
     */
    async execute(interaction) {
        try {
            const [prefix, dataString] = interaction.customId.split(':');
            const data = JSON.parse(dataString);

            const { action, line, route, page, userId } = data;

            // Ensure the interaction is from the original user
            if (interaction.user.id !== userId) {
                return interaction.reply({
                    content: '⚠️ No puedes interactuar con los botones de otra persona.',
                });
            }

            let newPage = page;
            if (action === 'prev') {
                newPage = Math.max(0, page - 1);
            } else if (action === 'next') {
                newPage = page + 1;
            }

            const { embed, components } = getExpressRoutePage(line, route, newPage, userId);

            await interaction.update({ embeds: [embed], components });

        } catch (error) {
            console.error('Error handling express route pagination:', error);
            await interaction.reply({
                content: '❌ Ocurrió un error al procesar la paginación.',
            });
        }
    },
};
