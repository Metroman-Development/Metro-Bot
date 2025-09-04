const { SlashCommandBuilder } = require('discord.js');
const BaseCommand = require('../BaseCommand');
const { createEmbed } = require('../../../../utils/embeds');
const DatabaseService = require('../../../../core/database/DatabaseService');
const { CacheManager } = require('../../../../core/cache/CacheManager.js');

class VersionCommand extends BaseCommand {
    constructor() {
        super(new SlashCommandBuilder()
            .setName('version')
            .setDescription('Muestra la información de la versión actual del bot')
        );
        this.active = true;
        this.category = "Bot Info";
    }

    async execute(interaction) {
        const cacheKey = 'bot:version:latest';
        const cachedVersion = await CacheManager.get(cacheKey);

        if (cachedVersion) {
            return interaction.reply({
                embeds: [this.buildVersionEmbed(cachedVersion)]
            });
        }

        const databaseService = await DatabaseService.getInstance();
        const row = await databaseService.getBotVersion();

        let versionData;
        if (row) {
            versionData = {
                version: row.version,
                date: row.release_date,
                changes: row.changelog
            };
        } else {
            versionData = {
                version: "5.0.0",
                date: "No registrada",
                changes: "Versión inicial del bot"
            };
        }

        await CacheManager.set(cacheKey, versionData, 3600000); // 1 hour TTL

        await interaction.reply({
            embeds: [this.buildVersionEmbed(versionData)]
        });
    }

    buildVersionEmbed(versionData) {
        return createEmbed(
            `**Versión:** ${versionData.version}\n` +
            `**Fecha de lanzamiento:** ${versionData.date}\n` +
            `**Cambios:** ${versionData.changes}`,
            'info',
            '📜 Información de la Versión'
        );
    }
}

module.exports = new VersionCommand();