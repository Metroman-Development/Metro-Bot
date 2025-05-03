// File: metro.js
// File: _metplanificar.js
// File: metro.js
// File: _metplanificar.js
// File: metro.js
// File: _metplanificar.js
// File: _metplanificar.js
const { SlashCommandBuilder, EmbedBuilder, Collection } = require('discord.js');
const SearchCore = require('../../modules/metro/search/SearchCore');
const RoutePlanner = require('../../modules/metro/RoutePlanner');
const RouteButton = require('../../modules/interactions/buttons/RouteButton');
const TimeHelpers = require('../../modules/chronos/timeHelpers');

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
        stationSearcher.setDataSource(metro.api.getProcessedData());

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
            // Cooldown check
            const userId = interaction.user.id;
            const cooldownAmount = 10_000;

            if (cooldowns.has(userId)) {
                const expirationTime = cooldowns.get(userId) + cooldownAmount;
                if (Date.now() < expirationTime) {
                    const timeLeft = (expirationTime - Date.now()) / 1000;
                    return interaction.reply({
                        content: `⏱️ Por favor espera ${timeLeft.toFixed(1)} segundos antes de usar este comando nuevamente.`,
                        ephemeral: true
                    });
                }
            }

            cooldowns.set(userId, Date.now());
            setTimeout(() => cooldowns.delete(userId), cooldownAmount);

            const discreteMode = interaction.options.getBoolean('discreto') || false;

            // Send initial loading message for all users
            const loadingMessage = await interaction.reply({
                content: '🔄 Calculando ruta...',
                ephemeral: discreteMode,
                fetchReply: true
            });

            // Wait a moment before processing (for better UX)
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Delete the loading message only in discrete mode
         /*   if (discreteMode) {
                await interaction.deleteReply().catch(console.error);*/
            

            // Now defer the real reply (ephemeral only in discrete mode)
            
                await interaction.editReply({ content: '🔄 Procesando ruta...' });
            
            
            // Process the route request
            const originId = interaction.options.getString('origen');
            const destinationId = interaction.options.getString('destino');
            const farePeriod = interaction.options.getString('periodo');
            
            const stationSearcher = new SearchCore('station');
            stationSearcher.setDataSource(metro.api.getProcessedData());
            
            const [origin, destination] = await Promise.all([
                this._validateStation(originId, stationSearcher, 'origen'),
                this._validateStation(destinationId, stationSearcher, 'destino')
            ]);
            
            const routes = await RoutePlanner.getRoutes(origin.id, destination.id, farePeriod);
            if (!routes || routes.length === 0) {
                return interaction.editReply({
                    content: '❌ No se encontraron rutas disponibles para este viaje.',
                    ephemeral: true
                });
            }
            
            const routeData = {
                id: `${origin.id}-${destination.id}-${Date.now()}`,
                origin: {
                    id: origin.id,
                    name: origin.displayName,
                    line: origin.line
                },
                destination: {
                    id: destination.id,
                    name: destination.displayName,
                    line: destination.line
                },
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
            
            const routeButton = new RouteButton();
            const message = await routeButton.build(routeData, metro);
            
            await interaction.editReply(message);
            
        } catch (error) {
            console.error('Error en comando planificar:', error);
            await interaction.editReply({
                content: '❌ Ocurrió un error al planificar el viaje. Por favor intenta nuevamente.',
                ephemeral: true
            });
        }
    },
    
    async _validateStation(stationId, searcher, type) {
        const results = await searcher.search(stationId, {
            maxResults: 1,
            needsOneMatch: true
        });
        
        if (!results?.length) {
            throw new Error(`No se encontró la estación de ${type}`);
        }
        
        return results[0];
    }
};

