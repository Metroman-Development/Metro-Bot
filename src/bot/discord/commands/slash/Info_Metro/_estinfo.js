const { SlashCommandSubcommandBuilder } = require('discord.js');
const { createErrorEmbed } = require('../../../../../utils/embedFactory');
const DiscordMessageFormatter = require('../../../../../formatters/DiscordMessageFormatter');
const { MetroInfoProvider } = require('../../../../../utils/MetroInfoProvider');
const cacheManager = require('../../../../../utils/cacheManager');

module.exports = {
    data: new SlashCommandSubcommandBuilder()
        .setName('info')
        .setDescription('Muestra información general sobre una estación de metro.')
        .addStringOption(option =>
            option.setName('estacion')
                .setDescription('El nombre de la estación que deseas consultar.')
                .setAutocomplete(true)
                .setRequired(true)),

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused().toLowerCase();
        const metroInfoProvider = MetroInfoProvider.getInstance();
        const stations = Object.values(metroInfoProvider.getStations());
        const filteredStations = stations.filter(station => {
            const stationName = station.name || '';
            const stationCode = station.code || '';
            return stationName.toLowerCase().includes(focusedValue) ||
                stationCode.toLowerCase().includes(focusedValue);
        }).slice(0, 25);

        await interaction.respond(
            filteredStations.map(station => ({
                name: `Estación ${station.name} (L${station.line_id.toUpperCase()})`,
                value: station.code
            }))
        );
    },

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const metroInfoProvider = MetroInfoProvider.getInstance();
        const stationId = interaction.options.getString('estacion');
        const station = metroInfoProvider.getStation(stationId.toUpperCase());

        if (!station) {
            const errorEmbed = await createErrorEmbed('No se pudo encontrar la estación especificada. Por favor, selecciónala de la lista.');
            return await interaction.editReply({ embeds: [errorEmbed], ephemeral: true });
        }

        station.id = station.code;

        const formatter = new DiscordMessageFormatter();
        const messagePayload = await formatter.formatStationInfo(station, metroInfoProvider, interaction.user.id);

        const message = await interaction.editReply(messagePayload);

        const collector = message.createMessageComponentCollector({
            filter: i => i.user.id === interaction.user.id,
            time: 15 * 60 * 1000 // 15 minutes
        });

        collector.on('collect', async i => {
            try {
                await i.deferUpdate();
                let tab;
                let stationId;

                if (i.isStringSelectMenu()) {
                    const selectedValue = i.values[0];
                    [, stationId, tab] = selectedValue.split(':');
                } else {
                    [, stationId, tab] = i.customId.split(':');
                }

                const cacheKey = formatter._getCacheKey(stationId, i.user.id);
                const cacheData = cacheManager.get(cacheKey);

                if (cacheData) {
                    cacheData.currentTab = tab;
                    cacheManager.set(cacheKey, cacheData);

                    const newMessagePayload = await formatter._createStationMessage(cacheData, i.user.id);
                    await i.editReply(newMessagePayload);
                }
            } catch (error) {
                // Ignore "Unknown Interaction" errors, as they are likely caused by a race condition
                // with the global interaction handler.
                if (error.code === 10062) {
                    console.warn(`[estinfo.js] Collector caught an expired interaction. Code: ${error.code}. This is likely a race condition and can be ignored.`);
                    return;
                }
                console.error('[estinfo.js] Collector failed:', error);
            }
        });

        collector.on('end', collected => {
            // Optional: disable components after collector expires
            const lastInteraction = collected.last();
            if (lastInteraction) {
                const disabledPayload = { ...lastInteraction.message, components: [] };
                interaction.editReply(disabledPayload);
            }
        });
    }
};