module.exports = {
    customId: 'nav_', // nav_back_123 or nav_home_123
    permissions: ['VIEW_CHANNEL'],
    ownerOnly: true,

    async execute(interaction, client) {
        const [_, action, userId, embedId] = interaction.customId.split('_');
        if (userId !== interaction.user.id) return this.denyInteraction(interaction);

        const cachedData = getCache(userId, embedId);
        if (!cachedData) return this.handleExpired(interaction);

        switch (action) {
            case 'back':
                await this.goBack(interaction, cachedData);
                break;
            case 'home':
                await this.goHome(interaction, cachedData);
                break;
        }
    },

    async goBack(interaction, cachedData) {
        if (!cachedData.history?.length) {
            return interaction.reply({ 
                content: '❌ No history to go back to.'
            });
        }

        const previousState = cachedData.history.pop();
        await interaction.update({
            embeds: [previousState.embed],
            components: previousState.components
        });
    },

    denyInteraction(interaction) {
        return interaction.reply({
            content: '❌ Only the command user can navigate.'
        });
    }
};