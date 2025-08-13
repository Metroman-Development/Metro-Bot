// templates/embeds/IntermodalEmbed.js
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { TabsTemplate } = require('../../events/Discord/interactions/templates/buttons/tabs.js');
const { CacheManager } = require('../../core/cache/CacheManagerV2.js');

class IntermodalEmbed {
    static ITEMS_PER_PAGE = 10;
    static CACHE_PREFIX = 'intermodal';

    constructor() {
        this.cache = new CacheManager(IntermodalEmbed.CACHE_PREFIX, {
            ttl: 300_000, // 5 minutes
            maxSize: 100
        });
    }

    // Main entry point
    async create(data, viewType = 'info', context = {}, page = 0) {
        const cacheKey = this._getCacheKey(context);
        await this.cache.set(cacheKey, data);

        return {
            embed: viewType === 'info'
                ? this._createMainEmbed(data)
                : await this._createRoutesEmbed(data, page, context),
            components: this._createComponents(viewType, context, page, data)
        };
    }

    // Tab system integration
    static createTabsHandler() {
        return TabsTemplate.create({
            idPrefix: IntermodalEmbed.CACHE_PREFIX,
            tabs: [
                { id: 'info', label: 'Información', emoji: 'ℹ️' },
                { id: 'routes', label: 'Recorridos', emoji: '🔄' }
            ],
            async fetchTabData(tabId, interaction) {
                const embed = new IntermodalEmbed();
                const cacheKey = embed._getCacheKeyFromInteraction(interaction);
                const data = await embed.cache.get(cacheKey);
                
                return {
                    tabId,
                    stationData: data,
                    page: parseInt(interaction.customId.split('_')[4] || 0)
                };
            },
            buildEmbed: (tabData) => {
                const embed = new IntermodalEmbed();
                return tabData.tabId === 'info'
                    ? embed._createMainEmbed(tabData.stationData)
                    : embed._createRoutesEmbed(tabData.stationData, tabData.page);
            },
            buildComponents: (tabData, interaction) => {
                const embed = new IntermodalEmbed();
                return embed._createComponents(
                    tabData.tabId,
                    { interaction },
                    tabData.page,
                    tabData.stationData
                );
            }
        });
    }

    // Private methods
    _createMainEmbed(details) {
        return new EmbedBuilder()
            .setTitle(`🚉 EIM ${details.Nombre || 'Estación Intermodal'}`)
            .setDescription(this._buildMainDescription(details))
            .setColor(0x0099FF) // Default blue
            .addFields(this._buildMainFields(details))
            .setThumbnail(this._getStationThumbnail(details))
            .setFooter({ text: this._createFooterText(details) });
    }

    async _createRoutesEmbed(details, page, context) {
        const routes = details.Recorridos || [];
        const paginated = this._paginate(routes, page);
        const formattedRoutes = await this._formatRoutes(paginated.items);

        return new EmbedBuilder()
            .setTitle(`🚌 EIM ${details.Nombre} - Recorridos`)
            .setDescription(formattedRoutes.join('\n') || 'No hay recorridos disponibles')
            .setColor(0xFFA500) // Orange for routes
            .setFooter({ 
                text: `Página ${paginated.currentPage + 1}/${paginated.totalPages}` +
                      (context.interaction ? ` • ${context.interaction.user.username}` : '')
            });
    }

    _createComponents(viewType, context, page, details) {
        const rows = [];
        
        // View toggle row
        rows.push(new ActionRowBuilder().addComponents(
            this._createTabButton('info', viewType, context),
            this._createTabButton('routes', viewType, context)
        ));

        // Pagination row if in routes view
        if (viewType === 'routes') {
            rows.push(this._createPaginationRow(page, details.Recorridos?.length || 0, context));
        }

        return rows;
    }

    _createTabButton(tabId, currentTab, context) {
        const isActive = tabId === currentTab;
        return new ButtonBuilder()
            .setCustomId(`${IntermodalEmbed.CACHE_PREFIX}_${tabId}_${
                context.userId || context.interaction.user.id}_${
                context.interactionId || context.interaction.id}`)
            .setLabel(tabId === 'info' ? '📃 General' : '🚏 Recorridos')
            .setStyle(isActive ? ButtonStyle.Primary : ButtonStyle.Secondary)
            .setEmoji(tabId === 'routes' ? '🔄' : null);
    }

    _createPaginationRow(currentPage, totalItems, context) {
        const totalPages = Math.ceil(totalItems / IntermodalEmbed.ITEMS_PER_PAGE);
        const baseId = `${IntermodalEmbed.CACHE_PREFIX}_routes_${
            context.userId || context.interaction.user.id}_${
            context.interactionId || context.interaction.id}`;

        return new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`${baseId}_${currentPage - 1}`)
                .setLabel('◀️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(currentPage <= 0),
            new ButtonBuilder()
                .setCustomId(`${baseId}_${currentPage + 1}`)
                .setLabel('▶️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(currentPage >= totalPages - 1)
        );
    }

    // Utility methods
    _paginate(items, page, perPage = IntermodalEmbed.ITEMS_PER_PAGE) {
        const totalPages = Math.ceil(items.length / perPage);
        const currentPage = Math.min(page, totalPages - 1);
        const start = currentPage * perPage;
        const end = start + perPage;

        return {
            items: items.slice(start, end),
            currentPage,
            totalPages
        };
    }

    async _formatRoutes(routes) {
        return routes.map((r, i) => 
            `**${i + 1}.** ${r['Tipo Servicio']} » ${r['Recorrido/Operador']} → ${r.Destino}`
        );
    }

    _buildMainDescription(details) {
        return [
            `📍 ${details.Ubicación || 'Ubicación no disponible'}`,
            details.message ? `\n📢 ${details.message}` : ''
        ].join('\n');
    }

    _buildMainFields(details) {
        return [
            { name: '🏙️ Comuna', value: details.Comuna || 'N/A', inline: true },
            { name: '📅 Inauguración', value: details.Inauguración || 'N/A', inline: true },
            { name: '🚉 Andenes', value: details['N.° de andenes']?.toString() || 'N/A', inline: true },
            { name: '📝 Operador', value: details.Operador || 'N/A', inline: true },
            { name: '🚌 Servicios', value: details.Servicios?.join(', ') || 'Ninguno', inline: false }
        ];
    }

    _getStationThumbnail(details) {
        return details.imageUrl || 'https://metro.cl/default-intermodal.png';
    }

    _createFooterText(details) {
        return `Actualizado: ${new Date().toLocaleString('es-CL')}`;
    }

    _getCacheKey(context) {
        if (context.interaction) {
            return this._getCacheKeyFromInteraction(context.interaction);
        }
        return `${IntermodalEmbed.CACHE_PREFIX}_${context.userId}_${context.interactionId}`;
    }

    _getCacheKeyFromInteraction(interaction) {
        const { userId, id: interactionId } = interaction;
        return `${IntermodalEmbed.CACHE_PREFIX}_${userId}_${interactionId}`;
    }
}

module.exports = { IntermodalEmbed };
