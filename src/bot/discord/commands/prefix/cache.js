const { createEmbed } = require('../../../../utils/embeds');
const { confirmAction } = require('../../../../utils/utils');
const { getCache, setCache, deleteCache, getAllCache, cache } = require('../../../../utils/cache');
const config = require('../../../../config');
const BaseCommand = require('../BaseCommand');

class CacheCommand extends BaseCommand {
    constructor() {
        super({
            name: 'cache',
            description: 'Ver y gestionar la caché. (Solo para el propietario)',
            usage: 'm!cache <subcomando>',
        });

        this.subcommands = new Map([
            ['view', this.handleViewCache],
            ['set', this.handleSetCache],
            ['delete', this.handleDeleteCache],
            ['clear', this.handleClearCache],
            ['help', this.showHelp],
            ['search', this.handleSearchCache],
        ]);
    }

    async run(message) {
        if (message.author.id !== config.ownerID) {
            return message.reply('❌ Este comando solo puede ser utilizado por el propietario del bot.');
        }

        const args = message.content.slice(config.prefix.length).trim().split(/ +/);
        args.shift(); // remove command name

        if (args.length === 0) {
            return this.showHelp(message);
        }

        const subcommandName = args[0].toLowerCase();
        const subArgs = args.slice(1);
        const subcommand = this.subcommands.get(subcommandName) || this.showHelp;

        await subcommand.call(this, message, subArgs);
    }

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
    }

    async handleViewCache(message, args) {
        if (args.length < 2) {
            return message.reply('❌ Uso correcto: `m!cache view <userId> <embedId>`');
        }
        const [userId, embedId] = args;
        const cacheEntry = getCache(userId, embedId);
        if (!cacheEntry) {
            return message.reply('❌ No se encontró ninguna entrada en la caché para los IDs proporcionados.');
        }
        const embed = createEmbed(
            `**Datos:** ${JSON.stringify(cacheEntry.data)}\n` +
            `**Timestamp:** ${new Date(cacheEntry.timestamp).toLocaleString()}`,
            'info',
            '📄 Entrada de la Caché'
        );
        await message.reply({ embeds: [embed] });
    }

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
    }

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
    }

    async handleClearCache(message) {
        const confirmed = await confirmAction(
            message,
            '⚠️ ¿Estás seguro de que deseas limpiar toda la caché? Esta acción no se puede deshacer.'
        );
        if (!confirmed) {
            return message.reply('❌ Operación cancelada.');
        }
        cache.clear();
        message.reply('✅ Caché limpiada correctamente.');
    }

    async handleSearchCache(message, args) {
        if (args.length < 1) {
            return message.reply('❌ Uso correcto: `m!cache search <userId|embedId>`');
        }
        const searchTerm = args[0];
        const allCacheEntries = getAllCache();
        const results = allCacheEntries.filter(entry =>
            entry.key.includes(searchTerm)
        );
        if (results.length === 0) {
            return message.reply('❌ No se encontraron entradas en la caché que coincidan con el término de búsqueda.');
        }
        const formattedResults = results.map(entry => (
            `**Clave:** ${entry.key}\n` +
            `**Datos:** ${JSON.stringify(entry.data)}\n` +
            `**Timestamp:** ${new Date(entry.timestamp).toLocaleString()}\n`
        )).join('\n');
        const embed = createEmbed(
            `**Resultados de la búsqueda para "${searchTerm}":**\n\n${formattedResults}`,
            'info',
            '🔍 Resultados de la Búsqueda en la Caché'
        );
        await message.reply({ embeds: [embed] });
    }
}

module.exports = new CacheCommand();