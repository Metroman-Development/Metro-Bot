const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const cacheManager = require('../../../utils/cacheManager');
const styles = { defaultTheme: { primaryColor: '#000000', infoColor: '#000000' } };

const CUSTOM_ID_PREFIX = 'cmd';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache for command structure

// --- Helper Functions ---

function _getCommandCategories(client) {
    const key = 'command_categories';
    let categories = cacheManager.get(key);
    if (categories) return categories;

    const categorySet = new Set(['General']);
    client.commands.forEach(cmd => {
        if (cmd.category) categorySet.add(cmd.category);
        if (cmd.subcommands) {
            cmd.subcommands.forEach(subCmd => {
                if (subCmd.category) categorySet.add(subCmd.category);
            });
        }
    });

    categories = Array.from(categorySet).map(cat => ({
        id: cat.toLowerCase().replace(/\s+/g, '-'),
        name: cat
    }));
    cacheManager.set(key, categories, CACHE_DURATION);
    return categories;
}

function _getCommandsByCategory(client, categoryId) {
    const categories = _getCommandCategories(client);
    const categoryName = categories.find(c => c.id === categoryId)?.name;
    if (!categoryName) return [];

    const commands = [];
    client.commands.forEach(cmd => {
        if (cmd.category === categoryName) commands.push(cmd);
        if (cmd.subcommands) {
            cmd.subcommands.forEach(subCmd => {
                if (subCmd.category === categoryName) {
                    commands.push({ ...subCmd, isSubcommand: true, parentCommand: cmd.data.name });
                }
            });
        }
    });
    return commands;
}

function _findCommand(client, commandName) {
    return client.commands.get(commandName);
}

function _createCategoryView(client, activeCategoryId) {
    const categories = _getCommandCategories(client);
    const activeCategory = categories.find(c => c.id === activeCategoryId) || categories[0];
    const commands = _getCommandsByCategory(client, activeCategory.id);

    const embed = new EmbedBuilder()
        .setTitle('📚 Navegador de Comandos')
        .setDescription(`**Categoría: ${activeCategory.name}**\n${commands.length} comandos encontrados.`)
        .setColor(styles.defaultTheme.primaryColor);

    if (commands.length > 0) {
        embed.addFields({
            name: '\u200B',
            value: commands.map(cmd => `\`/${cmd.isSubcommand ? `${cmd.parentCommand} ` : ''}${cmd.data.name}\` - ${cmd.data.description}`).join('\n').substring(0, 1024)
        });
    }

    const components = [];
    const categoryChunks = [];
    for (let i = 0; i < categories.length; i += 5) {
        categoryChunks.push(categories.slice(i, i + 5));
    }

    categoryChunks.forEach(chunk => {
        components.push(new ActionRowBuilder().addComponents(
            chunk.map(cat =>
                new ButtonBuilder()
                    .setCustomId(`${CUSTOM_ID_PREFIX}:category:${cat.id}`)
                    .setLabel(cat.name)
                    .setStyle(cat.id === activeCategory.id ? ButtonStyle.Primary : ButtonStyle.Secondary)
            )
        ));
    });

    return { embeds: [embed], components };
}

function _createCommandView(client, commandName) {
    const command = _findCommand(client, commandName);
    if (!command) return { content: 'Comando no encontrado.', embeds: [], components: [], ephemeral: true };

    const embed = new EmbedBuilder()
        .setTitle(`Comando: /${command.data.name}`)
        .setDescription(command.data.description)
        .setColor(styles.defaultTheme.infoColor)
        .addFields({ name: 'Categoría', value: command.category || 'General', inline: true });

    if(command.subcommands && command.subcommands.size > 0){
        const subcommands = Array.from(command.subcommands.values()).map(sub => `\`${sub.data.name}\``).join(', ');
        embed.addFields({ name: 'Subcomandos', value: subcommands });
    }

    const components = [
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`${CUSTOM_ID_PREFIX}:category:${(command.category || 'general').toLowerCase().replace(/\s+/g, '-')}`)
                .setLabel('◀ Volver a la categoría')
                .setStyle(ButtonStyle.Secondary)
        )
    ];

    return { embeds: [embed], components };
}

// --- Exported Functions ---

function buildCommandBrowser(client) {
    const initialCategory = _getCommandCategories(client)[0]?.id || 'general';
    return _createCategoryView(client, initialCategory);
}

async function execute(interaction) {
    const [_, action, identifier] = interaction.customId.split(':');
    const client = interaction.client;

    let messagePayload;

    try {
        switch (action) {
            case 'category':
                messagePayload = _createCategoryView(client, identifier);
                break;
            case 'command':
                messagePayload = _createCommandView(client, identifier);
                break;
            default:
                messagePayload = { content: 'Acción desconocida.', embeds: [], components: [], ephemeral: true };
        }
        await interaction.update(messagePayload);
    } catch (error) {
        console.error(`[${CUSTOM_ID_PREFIX}] Error handling interaction:`, error);
        await interaction.reply({ content: 'Ocurrió un error al procesar tu solicitud.', ephemeral: true }).catch(e => {});
    }
}

module.exports = {
    customIdPrefix: CUSTOM_ID_PREFIX,
    execute,
    buildCommandBrowser,
};
