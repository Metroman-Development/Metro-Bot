const { SlashCommandBuilder } = require('discord.js');
const SearchCore = require('../../../../../core/metro/search/SearchCore');
const RoutePlanner = require('../../../../../core/metro/RoutePlanner');
const routeButtonsHandler = require('../../../../../events/interactions/buttons/routeButtons');
const TimeHelpers = require('../../../../../core/chronos/timeHelpers');
const { Collection } = require('discord.js');

const cooldowns = new Collection();

module.exports = {
    parentCommand: 'metro',
    data: (subcommand) => subcommand
        .setName('planificar')
        .setDescription('Planifica un viaje en el Metro de Santiago')
        .addStringOption(option =>
            option.setName('origen')
                .setDescription('Estación de origen')
                .setRequired(true)
                .setAutocomplete(true))
        .addStringOption(option =>
            option.setName('destino')
                .setDescription('Estación de destino')
                .setRequired(true)
                .setAutocomplete(true))
        .addStringOption(option =>
            option.setName('periodo')
                .setDescription('Período tarifario')
                .setRequired(true)
                .addChoices(
                    { name: 'Punta (Mañana/Tarde)', value: 'PUNTA' },
                    { name: 'Valle (Mediodía)', value: 'VALLE' },
                    { name: 'Bajo (Noche/Madrugada)', value: 'BAJO' }
                ))
        .addBooleanOption(option =>
            option.setName('discreto')
                .setDescription('Modo discreto (oculta la información de tu ruta)')
                .setRequired(false)),

    async autocomplete(interaction, metro) {
        const focusedValue = interaction.options.getFocused().toLowerCase();
        const stationSearcher = new SearchCore('station');
        stationSearcher.setDataSource(await metro.getCurrentData());

        const results = await stationSearcher.search(focusedValue, { 
            maxResults: 25,
            searchFields: ['name', 'id']
        });

        await interaction.respond(
            results.map(result => ({
                name: `Estación ${result.displayName} (L${result.line.toUpperCase()})`,
                value: result.id
            }))
        );
    },

    async execute(interaction, metro) {
        try {
            const userId = interaction.user.id;
            const cooldownAmount = 10_000;

            if (cooldowns.has(userId)) {
                const expirationTime = cooldowns.get(userId) + cooldownAmount;
                if (Date.now() < expirationTime) {
                    const timeLeft = (expirationTime - Date.now()) / 1000;
                    return interaction.reply({
                        content: `⏱️ Por favor espera ${timeLeft.toFixed(1)} segundos.`,
                        ephemeral: true
                    });
                }
            }

            cooldowns.set(userId, Date.now());
            setTimeout(() => cooldowns.delete(userId), cooldownAmount);

            await interaction.deferReply({ ephemeral: interaction.options.getBoolean('discreto') || false });
            
            const originId = interaction.options.getString('origen');
            const destinationId = interaction.options.getString('destino');
            const farePeriod = interaction.options.getString('periodo');
            
            const stationSearcher = new SearchCore('station');
            stationSearcher.setDataSource(await metro.getCurrentData());
            
            const [origin, destination] = await Promise.all([
                this._validateStation(originId, stationSearcher, 'origen'),
                this._validateStation(destinationId, stationSearcher, 'destino')
            ]);
            
            const routes = await RoutePlanner.getRoutes(origin.id, destination.id, farePeriod);
            if (!routes || routes.length === 0) {
                return interaction.editReply({ content: '❌ No se encontraron rutas.', ephemeral: true });
            }
            
            const routeData = {
                id: `${origin.id}-${destination.id}-${Date.now()}`,
                origin: { id: origin.id, name: origin.displayName, line: origin.line },
                destination: { id: destination.id, name: destination.displayName, line: destination.line },
                farePeriod,
                options: {
                    fastest: routes[0],
                    slowest: routes[routes.length - 1],
                    rawData: routes
                }
            };
            
            if (routes.length > 2) {
                routeData.options.balanced = routes[Math.floor(routes.length / 2)];
            }
            
            const context = {
                route: routeData,
                metroData: await metro.getCurrentData(),
                staticData: metro._staticData
            };

            const message = await routeButtonsHandler.build(interaction, context);
            
            await interaction.editReply(message);
            
        } catch (error) {
            console.error('Error en comando planificar:', error);
            await interaction.editReply({ content: '❌ Error al planificar el viaje.', ephemeral: true });
        }
    },
    
    async _validateStation(stationId, searcher, type) {
        const results = await searcher.search(stationId, { maxResults: 1, needsOneMatch: true });
        if (!results?.length) throw new Error(`Estación de ${type} no encontrada.`);
        return results[0];
    }
};
