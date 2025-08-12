const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// Pagination Row (Previous/Next)
const createPaginationRow = (userId, embedId, currentPage, totalPages) => {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`page_prev_${userId}_${embedId}`)
            .setLabel('◀')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(currentPage <= 0),
        new ButtonBuilder()
            .setCustomId(`page_next_${userId}_${embedId}`)
            .setLabel('▶')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(currentPage >= totalPages - 1)
    );
};

// Navigation Row (Back/Home)
const createNavigationRow = (userId, embedId) => {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`nav_back_${userId}_${embedId}`)
            .setLabel('Back')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`nav_home_${userId}_${embedId}`)
            .setLabel('Home')
            .setStyle(ButtonStyle.Primary)
    );
};

module.exports = { createPaginationRow, createNavigationRow };
