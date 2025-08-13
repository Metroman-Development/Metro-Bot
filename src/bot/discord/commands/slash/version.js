const { SlashCommandBuilder } = require('discord.js');
const { createEmbed } = require('../../../../utils/embeds');
const { DatabaseManager } = require('../core/database/DatabaseManager');
const { CacheManager } = require('../core/cache/CacheManager');

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
            const conn = await DatabaseManager.getConnection();
            try {
                const [rows] = await conn.query(`
                    SELECT version, release_date, changelog 
                    FROM bot_versions 
                    ORDER BY created_at DESC 
                    LIMIT 1
                `);
                
                let versionData;
                if (rows.length > 0) {
                    versionData = {
                        version: rows[0].version,
                        date: rows[0].release_date,
                        changes: rows[0].changelog
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
            } finally {
                conn.release();
            }
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