const { Client } = require('discord.js');
const logger = require('./logger');

// Mapeo de roles
const ROLES = {
    'Pasajero Ocasional': '908461052738564218',
    'Viajero Frecuente': '908461746660978748',
    'Explorador del Metro': '908461899551764490',
    'Maestro de Líneas': '1353384386728300697',
    'Leyenda del Metro': '1353384386728300697'
};

module.exports = {
    lastAnnouncements: new Map(),

    /**
     * Envía un anuncio al canal de anuncios.
     * @param {Client} client - Cliente de Discord.
     * @param {string} userId - ID del usuario.
     * @param {string} type - Tipo de anuncio.
     * @param {number|string} value - Valor asociado al anuncio.
     */
    async sendAnnouncement(client, userId, type, value = 0) {
        try {
            const now = Date.now();
            const lastAnnounce = this.lastAnnouncements.get(userId) || 0;

            // Evitar anuncios duplicados en 5 minutos
            if (now - lastAnnounce < 300000) return;

            const messages = {
                streak_start: `🎉 ¡Nueva racha iniciada! <@${userId}> ha obtenido +${value} Bip!Coins desde el último anuncio.`,
                streak_continue: `🔥 ¡Racha en progreso! <@${userId}> lleva ${value} días activos.`,
                streak_end: `😢 ¡Racha rota! <@${userId}> ha terminado una racha de ${value} días.`,
                bonus: `📈 ¡Actividad recompensada! <@${userId}> ha ganado +${value} Bip!Coins.`,
                role_upgrade: `🏆 ¡Nuevo rol desbloqueado! <@${userId}> ahora es <@&${ROLES[value]}> con ${value} Bip!Coins.`,
                level_up: `🎉 ¡Felicidades <@${userId}>! Has alcanzado el nivel **${value}**. 🎉`
            };

            const channel = client.channels.cache.get('1347146518943105085'); // ID del canal de anuncios
            if (channel) {
                await channel.send(messages[type]);
                this.lastAnnouncements.set(userId, now);
            }
        } catch (error) {
            logger.error('❌ Error en anuncio:', error);
        }
    }
};