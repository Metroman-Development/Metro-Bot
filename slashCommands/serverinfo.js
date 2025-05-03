// slashCommands/serverInfo.js

// slashCommands/serverinfo.js
const { SlashCommandBuilder } = require('discord.js');
const BaseCommand = require('../templates/baseCommand');
const ServerInfoEmbed = require('../templates/embeds/ServerInfoEmbed');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('serverinfo')
        .setDescription('Muestra información detallada del servidor'),
    category: "Información",
    active: true,

    async execute(interaction) {
        await interaction.deferReply();
        const baseCommand = new BaseCommand();

        try {
            const guild = interaction.guild;
            const owner = await guild.fetchOwner();
            
            // Prepare server data
            const serverData = {
                name: guild.name,
                id: guild.id,
                owner: {
                    id: owner.id,
                    tag: owner.user.tag,
                    avatar: owner.user.displayAvatarURL()
                },
                memberCount: guild.memberCount,
                createdAt: guild.createdAt.toLocaleDateString('es-CL'),
                region: guild.preferredLocale,
                verificationLevel: guild.verificationLevel,
                premiumTier: guild.premiumTier,
                premiumCount: guild.premiumSubscriptionCount,
                features: guild.features,
                channels: {
                    total: guild.channels.cache.size,
                    categories: guild.channels.cache.filter(c => c.type === 'GUILD_CATEGORY').size,
                    text: guild.channels.cache.filter(c => c.type === 'GUILD_TEXT').size,
                    voice: guild.channels.cache.filter(c => c.type === 'GUILD_VOICE').size
                },
                roles: guild.roles.cache.size,
                emojis: guild.emojis.cache.size,
                icon: guild.iconURL({ dynamic: true, size: 512 }),
                splash: guild.splashURL({ size: 512 }),
                banner: guild.bannerURL({ size: 512 })
            };

            // Cache the server data
            const cacheKey = await baseCommand.cacheInteraction(interaction, {
                command: 'serverinfo',
                data: serverData,
                currentView: 'main',
                page: 0
            });

            // Create and send the embed
            const embed = new ServerInfoEmbed().createMainEmbed(serverData, interaction.user);
            const buttons = this.createNavigationButtons(interaction, cacheKey);

            await interaction.editReply({ 
                embeds: [embed],
                components: buttons 
            });

        } catch (error) {
            await baseCommand.handleCommandError(interaction, error);
        }
    },

    createNavigationButtons(interaction, cacheKey) {
        const baseEmbed = new BaseEmbed();
        const rows = [];

        // Main navigation row
        const mainRow = new ActionRowBuilder().addComponents(
            baseEmbed.createButton(
                `serverinfo_channels_${cacheKey}`,
                'Canales',
                'Secondary',
                { emoji: '📚' }
            ),
            baseEmbed.createButton(
                `serverinfo_roles_${cacheKey}`,
                'Roles',
                'Secondary',
                { emoji: '🎭' }
            ),
            baseEmbed.createButton(
                `serverinfo_emojis_${cacheKey}`,
                'Emojis',
                'Secondary',
                { emoji: '😀' }
            ),
            baseEmbed.createButton(
                `serverinfo_features_${cacheKey}`,
                'Features',
                'Secondary',
                { emoji: '✨' }
            )
        );
        rows.push(mainRow);

        return rows;
    }
};