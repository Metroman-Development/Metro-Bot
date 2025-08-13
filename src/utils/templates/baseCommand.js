// templates/baseCommand.js
const { setCache, getCache, deleteCache } = require('../../bot/discord/commands/prefix/cache.js');
const { setTimeout } = require('node:timers');

class BaseCommand {
    constructor() {
        this.defaultCacheTtl = 300000; // 5 minutes
    }

    async cacheInteraction(interaction, data) {
        const cacheKey = `${interaction.user.id}_${interaction.id}`;
        const timeout = setTimeout(() => {
            deleteCache(interaction.user.id, interaction.id);
        }, this.defaultCacheTtl);

        await setCache(interaction.user.id, cacheKey, {
            ...data,
            timeout
        });

        return cacheKey;
    }

    async getCachedInteraction(interaction) {
        return getCache(interaction.user.id, interaction.id);
    }

    clearCacheTimeout(cacheData) {
        if (cacheData?.timeout) {
            clearTimeout(cacheData.timeout);
        }
    }

    handleCommandError(interaction, error) {
        console.error(`[${interaction.commandName}] Error:`, error);
        return interaction.editReply({
            content: '⚠️ Ocurrió un error al procesar el comando',
            ephemeral: true
        });
    }
}

module.exports = BaseCommand;
