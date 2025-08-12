const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const cacheManager = require('../../../utils/cacheManager');

const CUSTOM_ID_PREFIX = 'serverInfo';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const ITEMS_PER_PAGE = 15;

// --- Helper Functions ---

function _createMainEmbed(guild) {
    return new EmbedBuilder()
        .setTitle(`🖥️ Información de ${guild.name}`)
        .setThumbnail(guild.iconURL({ dynamic: true }))
        .addFields(
            { name: '👑 Propietario', value: `<@${guild.ownerId}>`, inline: true },
            { name: '📅 Creado', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true },
            { name: '👥 Miembros', value: guild.memberCount.toString(), inline: true },
            { name: '🎭 Roles', value: guild.roles.cache.size.toString(), inline: true },
            { name: '📚 Canales', value: guild.channels.cache.size.toString(), inline: true },
            { name: '😀 Emojis', value: guild.emojis.cache.size.toString(), inline: true }
        )
        .setColor('#009688')
        .setFooter({ text: `ID: ${guild.id}` });
}

function _createListEmbed(guild, type, page) {
    const list = type === 'channels'
        ? guild.channels.cache.map(c => `\`${c.name}\``)
        : guild.roles.cache.map(r => r.name === '@everyone' ? '@everyone' : `<@&${r.id}>`);

    const totalPages = Math.ceil(list.length / ITEMS_PER_PAGE);
    const start = page * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    const itemsToShow = list.slice(start, end).join(', ');

    return new EmbedBuilder()
        .setTitle(`🖥️ ${type === 'channels' ? 'Canales' : 'Roles'} de ${guild.name}`)
        .setDescription(itemsToShow || 'No hay nada que mostrar.')
        .setColor('#009688')
        .setFooter({ text: `Página ${page + 1}/${totalPages}` });
}

function _createComponents(cacheKey, cacheData) {
    const { view, page, totalChannels, totalRoles } = cacheData;
    const mainRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`${CUSTOM_ID_PREFIX}:view:main:${cacheKey}`)
            .setLabel('Resumen')
            .setStyle(view === 'main' ? ButtonStyle.Primary : ButtonStyle.Secondary)
            .setDisabled(view === 'main'),
        new ButtonBuilder()
            .setCustomId(`${CUSTOM_ID_PREFIX}:view:channels:${cacheKey}`)
            .setLabel('Canales')
            .setStyle(view === 'channels' ? ButtonStyle.Primary : ButtonStyle.Secondary)
            .setDisabled(view === 'channels'),
        new ButtonBuilder()
            .setCustomId(`${CUSTOM_ID_PREFIX}:view:roles:${cacheKey}`)
            .setLabel('Roles')
            .setStyle(view === 'roles' ? ButtonStyle.Primary : ButtonStyle.Secondary)
            .setDisabled(view === 'roles')
    );

    const components = [mainRow];

    if (view === 'channels' || view === 'roles') {
        const totalItems = view === 'channels' ? totalChannels : totalRoles;
        const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
        if (totalPages > 1) {
            const paginationRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`${CUSTOM_ID_PREFIX}:page:prev:${cacheKey}`)
                    .setLabel('◀️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(page === 0),
                new ButtonBuilder()
                    .setCustomId(`${CUSTOM_ID_PREFIX}:page:indicator:${cacheKey}`)
                    .setLabel(`${page + 1}/${totalPages}`)
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true),
                new ButtonBuilder()
                    .setCustomId(`${CUSTOM_ID_PREFIX}:page:next:${cacheKey}`)
                    .setLabel('▶️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(page >= totalPages - 1)
            );
            components.push(paginationRow);
        }
    }
    return components;
}

// --- Exported Functions ---

function build(interaction) {
    const userId = interaction.user.id;
    const guild = interaction.guild;
    const cacheKey = `${CUSTOM_ID_PREFIX}:${userId}:${interaction.id}`;

    const cacheData = {
        userId,
        view: 'main',
        page: 0,
        totalChannels: guild.channels.cache.size,
        totalRoles: guild.roles.cache.size,
    };
    cacheManager.set(cacheKey, cacheData, CACHE_DURATION);

    const embed = _createMainEmbed(guild);
    const components = _createComponents(cacheKey, cacheData);

    return { embeds: [embed], components };
}

async function execute(interaction) {
    const [_, type, action, cacheKey] = interaction.customId.split(':');
    let cacheData = cacheManager.get(cacheKey);

    if (!cacheData || cacheData.userId !== interaction.user.id) {
        return interaction.update({ content: 'Esta interacción ha expirado o no te pertenece.', embeds: [], components: [] }).catch(()=>{});
    }

    if (type === 'view') {
        cacheData.view = action;
        cacheData.page = 0;
    } else if (type === 'page') {
        const totalItems = cacheData.view === 'channels' ? cacheData.totalChannels : cacheData.totalRoles;
        const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
        if (action === 'prev') cacheData.page = Math.max(0, cacheData.page - 1);
        if (action === 'next') cacheData.page = Math.min(totalPages - 1, cacheData.page + 1);
    }

    cacheManager.set(cacheKey, cacheData, CACHE_DURATION);

    const embed = cacheData.view === 'main'
        ? _createMainEmbed(interaction.guild)
        : _createListEmbed(interaction.guild, cacheData.view, cacheData.page);

    const components = _createComponents(cacheKey, cacheData);

    await interaction.update({ embeds: [embed], components });
}

module.exports = {
    customIdPrefix: CUSTOM_ID_PREFIX,
    execute,
    build,
};
