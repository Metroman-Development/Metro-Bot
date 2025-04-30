module.exports = {
    customId: 'help-category', // This matches the customId of the select menu
    async execute(interaction, client) {
        // Retrieve the categories from the client object
        const categories = client.helpData?.get(interaction.user.id)?.categories;

        if (!categories) {
            return await interaction.reply({
                content: '❌ No se encontraron categorías. Por favor, intenta nuevamente.',
                ephemeral: true,
            });
        }

        // Get the selected category
        const selectedCategory = interaction.values[0];
        const categoryCommands = categories[selectedCategory];

        if (!categoryCommands) {
            return await interaction.reply({
                content: '❌ Categoría no válida. Por favor, selecciona una categoría válida.',
                ephemeral: true,
            });
        }

        // Create the embed for the selected category
        const categoryEmbed = new EmbedBuilder()
            .setTitle(`📂 **${selectedCategory} - Comandos**`)
            .setColor('#2196F3')
            .addFields(categoryCommands)
            .setFooter({ text: `📄 ${categoryCommands.length} comandos disponibles` });

        // Update the interaction with the new embed
        await interaction.update({
            embeds: [categoryEmbed],
            components: [
                new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId('help-category')
                        .setPlaceholder('📂 Selecciona una categoría')
                        .addOptions(Object.keys(categories).map(category => ({
                            label: category,
                            description: `📄 Ver comandos de ${category}`,
                            value: category,
                        })))
                ),
            ],
        });
    },
};