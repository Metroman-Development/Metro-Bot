module.exports = {
    customId: 'show_map', // This matches the customId of the "Ver Mapa de Alrededores" button
    async execute(interaction, client) {
        // Retrieve the station data from the client object
        const station = client.stationData?.get(interaction.user.id);

        if (!station) {
            return await interaction.reply({
                content: '❌ No se pudo cargar la información de la estación. Por favor, intenta nuevamente.',
                ephemeral: true,
            });
        }

        // Respond with a map or additional information
        await interaction.reply({
            content: `🌍 **Mapa de Alrededores para ${station.nombre}:** [Ver Mapa](https://example.com/map)`, // Replace with actual map URL
            ephemeral: true,
        });
    },
};