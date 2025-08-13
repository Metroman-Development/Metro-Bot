class NavigationTemplate {
    static backButton(idPrefix) {
        return {
            customId: `${idPrefix}_back`,
            async execute(interaction) {
                const [_, __, bridgeId] = interaction.customId.split('_');
                const bridge = await BridgeManager.get(bridgeId);
                const prevState = bridge.history.pop();
                
                await interaction.update({
                    embeds: [prevState.embed],
                    components: [prevState.buttons]
                });
            }
        };
    }
}

module.exports = NavigationTemplate;