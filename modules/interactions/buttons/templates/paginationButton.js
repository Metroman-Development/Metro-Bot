const BaseButton = require('./baseButton');
const { ButtonStyle } = require('discord.js');

class PaginationButton extends BaseButton {
    constructor(options = {}) {
        super({
            customIdPrefix: 'pageBtn',
            style: ButtonStyle.Secondary,
            ...options
        });
        this.pageSize = options.pageSize || 10;
    }

    async buildPagination(userId, currentPage, totalItems, extraMetadata = {}) {
        const totalPages = Math.ceil(totalItems / this.pageSize);
        
        return [
            new ActionRowBuilder().addComponents([
                this.buildPageButton('first', '⏮', userId, 1, totalPages, extraMetadata),
                this.buildPageButton('prev', '◀', userId, Math.max(1, currentPage-1), totalPages, extraMetadata),
                this.buildPageButton('next', '▶', userId, Math.min(totalPages, currentPage+1), totalPages, extraMetadata),
                this.buildPageButton('last', '⏭', userId, totalPages, totalPages, extraMetadata)
            ]),
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(this.generateCustomId({
                        action: 'refresh',
                        userId,
                        ...extraMetadata
                    }))
                    .setLabel(`Page ${currentPage}/${totalPages}`)
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(true)
            )
        ];
    }

    buildPageButton(type, label, userId, page, totalPages, metadata) {
        return new ButtonBuilder()
            .setCustomId(this.generateCustomId({
                action: type,
                page,
                userId,
                ...metadata
            }))
            .setLabel(label)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(
                (type === 'first' || type === 'prev') && page === 1 ||
                (type === 'last' || type === 'next') && page === totalPages
            );
    }

    async handleInteraction(interaction, metadata) {
        if (metadata.action === 'refresh') return;
        
        // Fetch new page data
        const items = await this.fetchPageData(
            metadata.page, 
            this.pageSize,
            metadata
        );
        
        // Update message
        await interaction.update({
            content: this.formatPage(items, metadata.page),
            components: await this.buildPagination(
                interaction.user.id,
                metadata.page,
                await this.getTotalCount(metadata),
                metadata
            )
        });
    }

    // Override these in child classes:
    async fetchPageData(page, pageSize, metadata) {
        throw new Error('fetchPageData() must be implemented');
    }

    async getTotalCount(metadata) {
        throw new Error('getTotalCount() must be implemented');
    }

    formatPage(items, currentPage) {
        return `Page ${currentPage}\n${items.join('\n')}`;
    }
}

module.exports = PaginationButton;