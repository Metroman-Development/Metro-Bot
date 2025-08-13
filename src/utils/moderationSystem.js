const { Client, EmbedBuilder } = require('discord.js');
const pool = require('./database');
const logger = require('../events/logger');
const modConfig = require('../config/modConfig');

// Function to initialize the moderation table if it doesn't exist
async function initializeModerationTable() {
    try {
        const query = `
            CREATE TABLE IF NOT EXISTS moderation_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                action VARCHAR(50) NOT NULL, -- Type of action (e.g., ban, kick, mute, warn)
                user_id VARCHAR(50) NOT NULL, -- ID of the user who was moderated
                moderator_id VARCHAR(50) NOT NULL, -- ID of the moderator who performed the action
                reason TEXT, -- Reason for the moderation action
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP -- Timestamp of the action
            )
        `;
        await pool.execute(query);

        // Create a table for temporary bans
        const tempBanQuery = `
            CREATE TABLE IF NOT EXISTS temp_bans (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id VARCHAR(50) NOT NULL,
                moderator_id VARCHAR(50) NOT NULL,
                reason TEXT,
                unban_time DATETIME NOT NULL
            )
        `;
        await pool.execute(tempBanQuery);

        logger.info('✅ Moderation and temp bans tables initialized or already exist.');
    } catch (error) {
        logger.error('❌ Error initializing moderation table:', error);
    }
}

// Function to log a moderation action to the database
async function logModerationAction(action, userId, moderatorId, reason) {
    try {
        // Ensure the moderation table exists
        await initializeModerationTable();

        // Insert the moderation action into the database
        const query = `
            INSERT INTO moderation_logs (action, user_id, moderator_id, reason)
            VALUES (?, ?, ?, ?)
        `;
        const [result] = await pool.execute(query, [action, userId, moderatorId, reason]);

        logger.info(`✅ Moderation action logged: ${action} for user ${userId} by moderator ${moderatorId}.`);
        return result.insertId; // Return the ID of the inserted log
    } catch (error) {
        logger.error('❌ Error logging moderation action:', error);
        throw error; // Re-throw the error for handling in the calling function
    }
}

// Function to apply Bip!Coins penalties
async function applyBipCoinPenalty(userId, action) {
    try {
        const penalty = modConfig.bipCoinPenalties[action] || 0;
        if (penalty !== 0) {
            await pool.execute(`
                UPDATE users
                SET bip_coins = bip_coins + ?
                WHERE id = ?
            `, [penalty, userId]);
            logger.info(`✅ Applied ${penalty} Bip!Coins penalty to user ${userId} for ${action}.`);
        }
    } catch (error) {
        logger.error('❌ Error applying Bip!Coins penalty:', error);
        throw error;
    }
}

// Function to send moderation logs to the moderation logs channel
async function sendModerationLog(action, userId, moderatorId, reason, client) {
    try {
        const channel = client.channels.cache.get(modConfig.moderationLogsChannel);
        if (!channel) {
            throw new Error('Moderation logs channel not found.');
        }

        const embed = new EmbedBuilder()
            .setTitle(`Moderation Action: ${action}`)
            .addFields(
                { name: 'User', value: `<@${userId}>`, inline: true },
                { name: 'Moderator', value: `<@${moderatorId}>`, inline: true },
                { name: 'Reason', value: reason || 'No reason provided.', inline: false }
            )
            .setColor('#FF0000')
            .setTimestamp();

        await channel.send({ embeds: [embed] });
        logger.info(`✅ Moderation log sent to channel ${modConfig.moderationLogsChannel}.`);
    } catch (error) {
        logger.error('❌ Error sending moderation log:', error);
        throw error;
    }
}

// Function to ban a user without deleting messages
async function banUserWithoutDeleting(userId, moderatorId, reason, client) {
    try {
        const guild = client.guilds.cache.get(process.env.GUILD_ID); // Ensure you have the correct guild ID
        const member = guild.members.cache.get(userId);

        if (member) {
            await member.ban({ reason, days: 0 }); // days: 0 means no messages are deleted
            await logModerationAction('ban', userId, moderatorId, reason);
            await applyBipCoinPenalty(userId, 'ban');
            await sendModerationLog('ban', userId, moderatorId, reason, client);
            logger.info(`✅ User ${userId} has been banned (no messages deleted). Reason: ${reason}`);
        } else {
            throw new Error('User not found in the guild.');
        }
    } catch (error) {
        logger.error('❌ Error banning user (no messages deleted):', error);
        throw error;
    }
}

// Function to temporarily ban a user
async function tempBanUser(userId, moderatorId, reason, duration, client) {
    try {
        const guild = client.guilds.cache.get(process.env.GUILD_ID); // Ensure you have the correct guild ID
        const member = guild.members.cache.get(userId);

        if (member) {
            await member.ban({ reason, days: 7 }); // Ban the user and delete 7 days of messages
            await logModerationAction('temp_ban', userId, moderatorId, reason);
            await applyBipCoinPenalty(userId, 'ban');
            await sendModerationLog('temp_ban', userId, moderatorId, reason, client);

            // Calculate unban time
            const unbanTime = new Date(Date.now() + duration);
            await pool.execute(`
                INSERT INTO temp_bans (user_id, moderator_id, reason, unban_time)
                VALUES (?, ?, ?, ?)
            `, [userId, moderatorId, reason, unbanTime]);

            logger.info(`✅ User ${userId} has been temporarily banned for ${duration}ms. Reason: ${reason}`);

            // Unban the user after the duration
            setTimeout(async () => {
                try {
                    await guild.members.unban(userId, 'Temporary ban expired.');
                    await pool.execute('DELETE FROM temp_bans WHERE user_id = ?', [userId]);
                    logger.info(`✅ User ${userId} has been unbanned after temporary ban.`);
                } catch (error) {
                    logger.error('❌ Error unbanning user:', error);
                }
            }, duration);
        } else {
            throw new Error('User not found in the guild.');
        }
    } catch (error) {
        logger.error('❌ Error temporarily banning user:', error);
        throw error;
    }
}

// Function to check for expired temp bans on bot startup
async function checkTempBansOnStartup(client) {
    try {
        const [tempBans] = await pool.execute('SELECT * FROM temp_bans');
        const now = new Date();

        for (const tempBan of tempBans) {
            const unbanTime = new Date(tempBan.unban_time);
            if (unbanTime <= now) {
                // Unban the user immediately
                const guild = client.guilds.cache.get(process.env.GUILD_ID);
                await guild.members.unban(tempBan.user_id, 'Temporary ban expired.');
                await pool.execute('DELETE FROM temp_bans WHERE user_id = ?', [tempBan.user_id]);
                logger.info(`✅ User ${tempBan.user_id} has been unbanned after bot restart.`);
            } else {
                // Schedule the unban for the remaining time
                const remainingTime = unbanTime - now;
                setTimeout(async () => {
                    try {
                        const guild = client.guilds.cache.get(process.env.GUILD_ID);
                        await guild.members.unban(tempBan.user_id, 'Temporary ban expired.');
                        await pool.execute('DELETE FROM temp_bans WHERE user_id = ?', [tempBan.user_id]);
                        logger.info(`✅ User ${tempBan.user_id} has been unbanned after temporary ban.`);
                    } catch (error) {
                        logger.error('❌ Error unbanning user:', error);
                    }
                }, remainingTime);
                logger.info(`✅ Scheduled unban for user ${tempBan.user_id} in ${remainingTime}ms.`);
            }
        }
    } catch (error) {
        logger.error('❌ Error checking temp bans on startup:', error);
    }
}

// Function to kick a user
async function kickUser(userId, moderatorId, reason, client) {
    try {
        const guild = client.guilds.cache.get(process.env.GUILD_ID); // Ensure you have the correct guild ID
        const member = guild.members.cache.get(userId);

        if (member) {
            await member.kick(reason);
            await logModerationAction('kick', userId, moderatorId, reason);
            await applyBipCoinPenalty(userId, 'kick');
            await sendModerationLog('kick', userId, moderatorId, reason, client);
            logger.info(`✅ User ${userId} has been kicked. Reason: ${reason}`);
        } else {
            throw new Error('User not found in the guild.');
        }
    } catch (error) {
        logger.error('❌ Error kicking user:', error);
        throw error;
    }
}

// Function to mute a user (timeout)
async function muteUser(userId, moderatorId, reason, duration, client) {
    try {
        const guild = client.guilds.cache.get(process.env.GUILD_ID); // Ensure you have the correct guild ID
        const member = guild.members.cache.get(userId);

        if (member) {
            await member.timeout(duration, reason);
            await logModerationAction('mute', userId, moderatorId, reason);
            await applyBipCoinPenalty(userId, 'mute');
            await sendModerationLog('mute', userId, moderatorId, reason, client);
            logger.info(`✅ User ${userId} has been muted for ${duration}ms. Reason: ${reason}`);
        } else {
            throw new Error('User not found in the guild.');
        }
    } catch (error) {
        logger.error('❌ Error muting user:', error);
        throw error;
    }
}

// Function to warn a user
async function warnUser(userId, moderatorId, reason, client) {
    try {
        await logModerationAction('warn', userId, moderatorId, reason);
        await applyBipCoinPenalty(userId, 'warn');
        await sendModerationLog('warn', userId, moderatorId, reason, client);
        logger.info(`✅ User ${userId} has been warned. Reason: ${reason}`);
    } catch (error) {
        logger.error('❌ Error warning user:', error);
        throw error;
    }
}

module.exports = {
    initializeModerationTable,
    logModerationAction,
    banUserWithoutDeleting,
    tempBanUser,
    kickUser,
    muteUser,
    warnUser,
    applyBipCoinPenalty,
    sendModerationLog,
    checkTempBansOnStartup,
};