 // config/defaultEmbeds/serverInfoEmbeds.js
const { EmbedBuilder, ButtonStyle } = require('discord.js');
const { createButton, createActionRow } = require('../../utils/utils');

// Function to create the main server info embed
function createMainServerInfo(serverInfo, userId, interactionId) {
    const embed = new EmbedBuilder()
        .setTitle(`🖥️ Información del Servidor: ${serverInfo.name}`)
        .setThumbnail(serverInfo.icon)
        .addFields(
            { name: '👑 Propietario', value: serverInfo.owner.user.tag, inline: true },
            { name: '📅 Creado el', value: serverInfo.createdAt, inline: true },
            { name: '🌍 Región', value: serverInfo.region, inline: true },
            { name: '👥 Miembros', value: serverInfo.memberCount.toString(), inline: true },
            { name: '🎭 Roles', value: serverInfo.roles.toString(), inline: true },
            { name: '📚 Canales', value: serverInfo.channels.toString(), inline: true },
            { name: '😀 Emojis', value: serverInfo.emojis.toString(), inline: true },
        )
        .setColor('#009688')
        .setFooter({ text: `ID del Servidor: ${serverInfo.id}` });

    // Create buttons for additional actions
    const buttons = [
        createButton(
            `serverInfo_channels_${userId}_${interactionId}_0`, // Page 0
            'Ver Canales',
            ButtonStyle.Primary
        ),
        createButton(
            `serverInfo_roles_${userId}_${interactionId}_0`, // Page 0
            'Ver Roles',
            ButtonStyle.Secondary
        ),
    ];

    const actionRow = createActionRow(buttons);

    return { embed, buttons: [actionRow] };
}

// Function to create a paginated channels list embed
function createChannelsList(serverInfo, userId, interactionId, page = 0) {
    const channelsPerPage = 30;
    const totalPages = Math.ceil(serverInfo.channelsList.length / channelsPerPage);

    // Slice the channels list for the current page
    const start = page * channelsPerPage;
    const end = start + channelsPerPage;
    const channelsToShow = serverInfo.channelsList.slice(start, end).join('\n');

    const embed = new EmbedBuilder()
        .setTitle(`📚 Canales del Servidor: ${serverInfo.name}`)
        .setDescription(channelsToShow || 'No hay canales para mostrar.')
        .setColor('#009688')
        .setFooter({ text: `Página ${page + 1} de ${totalPages} | Total: ${serverInfo.channels} canales` });

    // Create pagination buttons
    const buttons = [];
    if (page > 0) {
        buttons.push(
            createButton(
                `serverInfo_channels_${userId}_${interactionId}_${page - 1}`,
                'Anterior',
                ButtonStyle.Secondary
            )
        );
    }
    if (page < totalPages - 1) {
        buttons.push(
            createButton(
                `serverInfo_channels_${userId}_${interactionId}_${page + 1}`,
                'Siguiente',
                ButtonStyle.Primary
            )
        );
    }

    // Add a "Go Back" button
    buttons.push(
        createButton(
            `serverInfo_main_${userId}_${interactionId}`,
            'Volver',
            ButtonStyle.Danger
        )
    );

    const actionRow = createActionRow(buttons);

    return { embed, buttons: [actionRow] };
}

// Function to create a paginated roles list embed
function createRolesList(serverInfo, userId, interactionId, page = 0) {
    const rolesPerPage = 30;
    const totalPages = Math.ceil(serverInfo.rolesList.length / rolesPerPage);

    // Slice the roles list for the current page
    const start = page * rolesPerPage;
    const end = start + rolesPerPage;
    const rolesToShow = serverInfo.rolesList.slice(start, end).join('\n');

    const embed = new EmbedBuilder()
        .setTitle(`🎭 Roles del Servidor: ${serverInfo.name}`)
        .setDescription(rolesToShow || 'No hay roles para mostrar.')
        .setColor('#009688')
        .setFooter({ text: `Página ${page + 1} de ${totalPages} | Total: ${serverInfo.roles} roles` });

    // Create pagination buttons
    const buttons = [];
    if (page > 0) {
        buttons.push(
            createButton(
                `serverInfo_roles_${userId}_${interactionId}_${page - 1}`,
                'Anterior',
                ButtonStyle.Secondary
            )
        );
    }
    if (page < totalPages - 1) {
        buttons.push(
            createButton(
                `serverInfo_roles_${userId}_${interactionId}_${page + 1}`,
                'Siguiente',
                ButtonStyle.Primary
            )
        );
    }

    // Add a "Go Back" button
    buttons.push(
        createButton(
            `serverInfo_main_${userId}_${interactionId}`,
            'Volver',
            ButtonStyle.Danger
        )
    );

    const actionRow = createActionRow(buttons);

    return { embed, buttons: [actionRow] };
}

module.exports = {
    createMainServerInfo,
    createChannelsList,
    createRolesList,
};