const { createEmbed } = require('../utils/embeds');

const { confirmAction } = require('../utils/utils'); // Import the confirmAction utility

const { getCache, setCache, deleteCache, getAllCache } = require('../utils/cache');// Import the cache functions and the cache Map

const config = require('../config/config.json'); // Import the config file

module.exports = {

    name: 'cache',

    description: 'Ver y gestionar la caché. (Solo para el propietario)',

    usage: 'm!cache <subcomando>',

    subcommands: {

        view: {

            description: 'Ver una entrada en la caché.',

            usage: 'm!cache view <userId> <embedId>'

        },

        set: {

            description: 'Establecer una entrada en la caché.',

            usage: 'm!cache set <userId> <embedId> <data>'

        },

        delete: {

            description: 'Eliminar una entrada de la caché.',

            usage: 'm!cache delete <userId> <embedId>'

        },

        clear: {

            description: 'Limpiar toda la caché.',

            usage: 'm!cache clear'

        },

        help: {

            description: 'Mostrar ayuda sobre los subcomandos disponibles.',

            usage: 'm!cache help'

        },

        search: {

            description: 'Buscar entradas en la caché por userId o embedId.',

            usage: 'm!cache search <userId|embedId>'

        }

    },

    async execute(message, args) {

        // Check if the user is the owner

        if (message.author.id !== config.ownerID) {

            return message.reply('❌ Este comando solo puede ser utilizado por el propietario del bot.');

        }

        // Check if a subcommand is provided

        if (args.length === 0) {

            return this.showHelp(message); // Show help if no subcommand is provided

        }

        const [subcommand, ...subArgs] = args;

        switch (subcommand) {

            case 'view':

                await this.handleViewCache(message, subArgs);

                break;

            case 'set':

                await this.handleSetCache(message, subArgs);

                break;

            case 'delete':

                await this.handleDeleteCache(message, subArgs);

                break;

            case 'clear':

                await this.handleClearCache(message);

                break;

            case 'help':

                await this.showHelp(message);

                break;

            case 'search':

                await this.handleSearchCache(message, subArgs);

                break;

            default:

                // If the subcommand is invalid, show help

                await this.showHelp(message);

        }

    },

    /**

     * Show help for the cache command.

     */

    async showHelp(message) {

        const embed = createEmbed(

            `**Subcomandos disponibles:**\n` +

            `\`m!cache view <userId> <embedId>\` - Ver una entrada en la caché.\n` +

            `\`m!cache set <userId> <embedId> <data>\` - Establecer una entrada en la caché.\n` +

            `\`m!cache delete <userId> <embedId>\` - Eliminar una entrada de la caché.\n` +

            `\`m!cache clear\` - Limpiar toda la caché.\n` +

            `\`m!cache help\` - Mostrar esta ayuda.\n` +

            `\`m!cache search <userId|embedId>\` - Buscar entradas en la caché.\n\n` +

            `**Nota:** Este comando solo puede ser utilizado por el propietario del bot.`,

            'info',

            '🛠️ Comando de Gestión de Caché'

        );

        await message.reply({ embeds: [embed] });

    },

    /**

     * Handle viewing a cache entry.

     */

    async handleViewCache(message, args) {

        if (args.length < 2) {

            return message.reply('❌ Uso correcto: `m!cache view <userId> <embedId>`');

        }

        const [userId, embedId] = args;

        const cacheEntry = getCache(userId, embedId);

        if (!cacheEntry) {

            return message.reply('❌ No se encontró ninguna entrada en la caché para los IDs proporcionados.');

        }

        // Create an embed to display the cache entry

        const embed = createEmbed(

            `**Datos:** ${JSON.stringify(cacheEntry.data)}\n` +

            `**Timestamp:** ${new Date(cacheEntry.timestamp).toLocaleString()}`,

            'info',

            '📄 Entrada de la Caché'

        );

        await message.reply({ embeds: [embed] });

    },

    /**

     * Handle setting a cache entry.

     */

    async handleSetCache(message, args) {

        if (args.length < 3) {

            return message.reply('❌ Uso correcto: `m!cache set <userId> <embedId> <data>`');

        }

        const [userId, embedId, ...dataParts] = args;

        const data = dataParts.join(' ');

        try {

            const parsedData = JSON.parse(data);

            setCache(userId, embedId, { data: parsedData });

            message.reply('✅ Entrada de caché establecida correctamente.');

        } catch (error) {

            console.error('Error al establecer la entrada de caché:', error);

            message.reply('❌ Ocurrió un error al establecer la entrada de caché. Asegúrate de que los datos sean un JSON válido.');

        }

    },

    /**

     * Handle deleting a cache entry.

     */

    async handleDeleteCache(message, args) {

        if (args.length < 2) {

            return message.reply('❌ Uso correcto: `m!cache delete <userId> <embedId>`');

        }

        const [userId, embedId] = args;

        const confirmed = await confirmAction(

            message,

            `⚠️ ¿Estás seguro de que deseas eliminar la entrada de caché para **${userId}_${embedId}**?`

        );

        if (!confirmed) {

            return message.reply('❌ Operación cancelada.');

        }

        deleteCache(userId, embedId);

        message.reply('✅ Entrada de caché eliminada correctamente.');

    },

    /**

     * Handle clearing the entire cache.

     */

    async handleClearCache(message) {

        const confirmed = await confirmAction(

            message,

            '⚠️ ¿Estás seguro de que deseas limpiar toda la caché? Esta acción no se puede deshacer.'

        );

        if (!confirmed) {

            return message.reply('❌ Operación cancelada.');

        }

        // Clear the cache

        cache.clear();

        message.reply('✅ Caché limpiada correctamente.');

    },

    /**

     * Handle searching for cache entries by userId or embedId.

     */

    

async handleSearchCache(message, args) {

    if (args.length < 1) {

        return message.reply('❌ Uso correcto: `m!cache search <userId|embedId>`');

    }

    const searchTerm = args[0];

    // Get all cache entries

    const allCacheEntries = getAllCache();

    // Search for cache entries that match the userId or embedId

    const results = allCacheEntries.filter(entry => 

        entry.key.includes(searchTerm)

    );

    if (results.length === 0) {

        return message.reply('❌ No se encontraron entradas en la caché que coincidan con el término de búsqueda.');

    }

    // Format the search results

    const formattedResults = results.map(entry => (

        `**Clave:** ${entry.key}\n` +

        `**Datos:** ${JSON.stringify(entry.data)}\n` +

        `**Timestamp:** ${new Date(entry.timestamp).toLocaleString()}\n`

    )).join('\n');

    // Create an embed to display the search results

    const embed = createEmbed(

        `**Resultados de la búsqueda para "${searchTerm}":**\n\n${formattedResults}`,

        'info',

        '🔍 Resultados de la Búsqueda en la Caché'

    );

    await message.reply({ embeds: [embed] });

}

};