const pool = require('../utils/database');
const logger = require('./logger');
const { Client } = require('discord.js');
const bipAnnouncements = require('./bipAnnouncements');
const bipConfig = require('../config/bipConfig');
const bipcoinUtils = require('../utils/bipcoinUtils');

// Cooldown de 1 minuto (60000 milisegundos)
const cooldowns = new Map(); // Almacena el tiempo de la última actividad de cada usuario

module.exports = {
    /**
     * Asigna un rol al usuario basado en sus Bip!Coins.
     * @param {string} userId - ID del usuario.
     * @param {string} username - Nombre del usuario.
     * @param {Client} client - Cliente de Discord.
     */
    async assignRole(userId, username, client) {
        let connection;
        try {
            connection = await pool.getConnection();
            const [user] = await connection.query('SELECT bip_coins, role FROM users WHERE id = ?', [userId]);
            const bipCoins = user[0]?.bip_coins || 0;

            // Determinar el nuevo rol
            let newRole = 'Pasajero Ocasional';
            if (bipCoins >= 20000) {
                newRole = 'Leyenda del Metro';
            } else if (bipCoins >= 8000) {
                newRole = 'Maestro de Líneas';
            } else if (bipCoins >= 2000) {
                newRole = 'Explorador del Metro';
            } else if (bipCoins >= 500) {
                newRole = 'Viajero Frecuente';
            }

            // Verificar si el rol ha cambiado
            if (user[0]?.role !== newRole) {
                // Actualizar el rol en la base de datos
                await connection.query('UPDATE users SET role = ? WHERE id = ?', [newRole, userId]);

                // Asignar el rol en Discord
                const guild = client.guilds.cache.get(process.env.GUILD_ID); // Asegúrate de obtener el guild correcto
                const member = guild.members.cache.get(userId);

                if (member) {
                    // Remover roles antiguos
                    const rolesToRemove = Object.values(bipConfig.ROLES);
                    await member.roles.remove(rolesToRemove);

                    // Asignar nuevo rol
                    const newRoleId = bipConfig.ROLES[newRole];
                    if (newRoleId) {
                        await member.roles.add(newRoleId);
                        logger.info(`✅ Rol "${newRole}" asignado a ${username}.`);
                    }
                }

                // Enviar anuncio
                await bipAnnouncements.sendAnnouncement(client, userId, 'role_upgrade', newRole);
            }
        } catch (error) {
            logger.error('❌ Error al asignar rol:', error);
        } finally {
            if (connection) connection.release();
        }
    },

    /**
     * Añade Bip!Coins y maneja anuncios
     */
    async addBipCoinsWithActivity(userId, username, client, activityType = 'message') {
        let connection;
        try {
            // Verificar cooldown
            const remainingTime = bipcoinUtils.checkCooldown(userId, cooldowns, bipConfig.COOLDOWN_TIME);
            if (remainingTime > 0) {
                logger.info(`⏳ ${username} está en cooldown. Intenta de nuevo en ${remainingTime} segundos.`);
                return 0; // No se otorgan Bip!Coins si el usuario está en cooldown
            }

            // Actualizar el tiempo de la última actividad
            cooldowns.set(userId, Date.now());

            connection = await pool.getConnection();
            const [userData] = await connection.query('SELECT * FROM users WHERE id = ?', [userId]);
            const user = userData[0];

            // Base de puntos
            const basePoints = bipConfig.BASE_POINTS[activityType] || 0;
            let activityBonus = 0;
            let newStreak = 1;
            let firstActivityOfDay = false;

            // Lógica de racha mejorada
            if (user) {
                const lastActive = user.last_active ? new Date(user.last_active) : null;
                const today = new Date();

                // Verificar primera actividad del día
                if (lastActive && bipcoinUtils.isSameDay(lastActive, today)) {
                    logger.info(`✅ ${username} ya recibió puntos hoy.`);
                } else {
                    firstActivityOfDay = true;
                }

                // Calcular racha solo si hay actividad previa
                if (lastActive) {
                    const yesterday = new Date(today);
                    yesterday.setDate(yesterday.getDate() - 1);

                    if (bipcoinUtils.isSameDay(lastActive, yesterday)) {
                        newStreak = Number(user.activity_streak) + 1;
                    } else if (!bipcoinUtils.isSameDay(lastActive, today)) {
                        if (user.activity_streak > 1) {
                            await bipAnnouncements.sendAnnouncement(client, userId, 'streak_end', user.activity_streak);
                        }
                        newStreak = 1;
                    }
                }

                activityBonus = Math.floor(Math.pow(0.1, newStreak)) || 0;
            }

            // Calcular puntos totales
            const totalPoints = basePoints + activityBonus + (firstActivityOfDay ? bipConfig.FIRST_ACTIVITY_BONUS : 0);

            // Actualizar base de datos
            await connection.query(`
                INSERT INTO users (id, username, bip_coins, last_active, activity_streak) 
                VALUES (?, ?, ?, NOW(), ?) 
                ON DUPLICATE KEY UPDATE 
                    bip_coins = COALESCE(bip_coins, 0) + ?,
                    last_active = NOW(),
                    activity_streak = ?
            `, [userId, username, totalPoints, newStreak, totalPoints, newStreak]);

            // Verificar si el usuario subió de nivel
            const oldLevel = bipcoinUtils.calculateLevel(user?.bip_coins || 0);
            const newLevel = bipcoinUtils.calculateLevel((user?.bip_coins || 0) + totalPoints);

            if (newLevel > oldLevel) {
                await bipAnnouncements.sendAnnouncement(client, userId, 'level_up', newLevel);
            }

            // Anuncios condicionales
            if (newStreak > 1 && newStreak !== Number(user?.activity_streak)) {
                await bipAnnouncements.sendAnnouncement(client, userId, 'streak_continue', newStreak);
            }

            logger.info(`✅ ${totalPoints} Bip!Coins añadidos a ${username}.`);
            return totalPoints;
        } catch (error) {
            logger.error('❌ Error:', error);
            return 0;
        } finally {
            if (connection) connection.release();
        }
    }
};