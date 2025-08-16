const { SlashCommandBuilder } = require('discord.js');
const { createEmbed } = require('../../../../utils/embeds');
const DatabaseService = require('../../../../core/database/DatabaseService');
const { CacheManager } = require('../../../../core/cache/CacheManager.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('version')
        .setDescription('Muestra la información de la versión actual del bot'),
    
    active: true,
    category: "Bot Info",
    
    async execute(interaction) {
        try {
            // Check cache first
            const cacheKey = 'bot:version:latest';
            const cachedVersion = await CacheManager.get(cacheKey);
            
            if (cachedVersion) {
                return interaction.reply({ 
                    embeds: [this.buildVersionEmbed(cachedVersion)]
                });
            }

            // Get from database if not in cache
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
                // Fallback to default version
                versionData = {
                    version: "5.0.0",
                    date: "No registrada",
                    changes: "Versión inicial del bot"
                };
            }

            // Cache the result for 1 hour
            await CacheManager.set(
                cacheKey,
                versionData,
                3600000 // 1 hour TTL
            );

            await interaction.reply({
                embeds: [this.buildVersionEmbed(versionData)]
            });
        } catch (error) {
            console.error('Error en comando /version:', error);
            
            // Fallback embed if everything fails
            const fallbackEmbed = createEmbed(
                '**Versión:** 5.0.0\n**Fecha:** No disponible\n**Cambios:** No se pudo cargar la información',
                'error',
                '⚠️ Información de Versión'
            );
            
            await interaction.reply({ 
                embeds: [fallbackEmbed],
                ephemeral: true 
            });
        }
    },
    
    buildVersionEmbed(versionData) {
        return createEmbed(
            `**Versión:** ${versionData.version}\n` +
            `**Fecha de lanzamiento:** ${versionData.date}\n` +
            `**Cambios:** ${versionData.changes}`,
            'info',
            '📜 Información de la Versión'
        );
    }
};