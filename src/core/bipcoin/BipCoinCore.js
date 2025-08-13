const { EmbedBuilder } = require('discord.js');
const DatabaseManager = require('../database/DatabaseManager');
const logger = require('../events/logger');
const crypto = require('crypto');

class BipCoinSystem {
    constructor(db, config = {}) {
        this.db = db;
        this.cooldowns = new Map();
        this.verificationCodes = new Map(); // Stores temporary verification codes
        
        // Configuration with defaults that can be overridden
        this.config = {
            BASE_POINTS: {
                MESSAGE: 1,
                VOICE: 2,
                COMMAND: 3,
                STREAK_BONUS: 5
            },
            COOLDOWN_TIME: 60 * 1000, // 1 minute in milliseconds
            CHANNELS: {
                ANNOUNCEMENTS: '1234567893',
                VERIFICATION: '1234567894'
            },
            VERIFICATION_CODE_EXPIRY: 15 * 60 * 1000, // 15 minutes
            // XP required for each level (can be formula-based)
            XP_PER_LEVEL: (level) => Math.floor(100 * Math.pow(level, 1.5)),
            ...config // Override with provided config
        };
    }

    /**
     * Initialize the BipCoin system
     */
    async initialize() {
        await this.createTablesIfNotExist();
    }

    /**
     * Creates necessary database tables if they don't exist
     */
    async createTablesIfNotExist() {
        await this.db.query(`
            CREATE TABLE IF NOT EXISTS bip_users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                discord_id VARCHAR(255) UNIQUE,
                discord_username VARCHAR(255),
                telegram_id VARCHAR(255) UNIQUE,
                telegram_username VARCHAR(255),
                bip_coins INT DEFAULT 0,
                level INT DEFAULT 1,
                streak INT DEFAULT 0,
                last_activity_date DATE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX (discord_id),
                INDEX (telegram_id)
        `);

        await this.db.query(`
            CREATE TABLE IF NOT EXISTS bip_roles (
                id INT AUTO_INCREMENT PRIMARY KEY,
                discord_role_id VARCHAR(255) UNIQUE,
                level_requirement INT,
                description VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await this.db.query(`
            CREATE TABLE IF NOT EXISTS bip_activity_log (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT,
                platform VARCHAR(10),
                activity_type VARCHAR(50),
                points_earned INT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES bip_users(id)
            )
        `);
    }

    /**
     * Get user by platform ID
     * @param {string} platform - 'discord' or 'telegram'
     * @param {string} userId - Platform user ID
     * @returns {Promise<object|null>} User data or null if not found
     */
    async getUserByPlatform(platform, userId) {
        const column = `${platform}_id`;
        const [rows] = await this.db.query(
            `SELECT * FROM bip_users WHERE ${column} = ?`,
            [userId]
        );
        return rows[0] || null;
    }

    /**
     * Get user by database ID
     * @param {number} userId - Database user ID
     * @returns {Promise<object|null>} User data or null if not found
     */
    async getUserById(userId) {
        const [rows] = await this.db.query(
            'SELECT * FROM bip_users WHERE id = ?',
            [userId]
        );
        return rows[0] || null;
    }

    /**
     * Get user by any platform ID (checks both discord and telegram)
     * @param {string} userId - Platform user ID
     * @returns {Promise<object|null>} User data or null if not found
     */
    async getUserByAnyPlatform(userId) {
        const [rows] = await this.db.query(
            'SELECT * FROM bip_users WHERE discord_id = ? OR telegram_id = ?',
            [userId, userId]
        );
        return rows[0] || null;
    }

    /**
     * Create or update user for a specific platform
     * @param {string} platform - 'discord' or 'telegram'
     * @param {string} userId - Platform user ID
     * @param {string} username - Platform username
     * @returns {Promise<object>} Created/updated user data
     */
    async upsertPlatformUser(platform, userId, username) {
        const idColumn = `${platform}_id`;
        const usernameColumn = `${platform}_username`;
        
        // Check if user exists with this platform ID
        let user = await this.getUserByPlatform(platform, userId);
        
        if (user) {
            // Update username if it has changed
            if (user[usernameColumn] !== username) {
                await this.db.query(
                    `UPDATE bip_users SET ${usernameColumn} = ? WHERE ${idColumn} = ?`,
                    [username, userId]
                );
                user[usernameColumn] = username;
            }
            return user;
        }
        
        // Check if user exists in the other platform
        const otherPlatform = platform === 'discord' ? 'telegram' : 'discord';
        user = await this.getUserByPlatform(otherPlatform, userId);
        
        if (user) {
            // User exists in the other platform - update this platform's info
            await this.db.query(
                `UPDATE bip_users SET ${idColumn} = ?, ${usernameColumn} = ? WHERE id = ?`,
                [userId, username, user.id]
            );
            
            // Get updated user
            return this.getUserById(user.id);
        }
        
        // Create new user
        await this.db.query(
            `INSERT INTO bip_users (${idColumn}, ${usernameColumn}) VALUES (?, ?)`,
            [userId, username]
        );
        
        return this.getUserByPlatform(platform, userId);
    }

    /**
     * Update user data
     * @param {number} userId - Database user ID
     * @param {object} updates - Object with fields to update
     */
    async updateUser(userId, updates) {
        const fields = [];
        const values = [];
        
        for (const [key, value] of Object.entries(updates)) {
            fields.push(`${key} = ?`);
            values.push(value);
        }
        
        values.push(userId);
        
        await this.db.query(
            `UPDATE bip_users SET ${fields.join(', ')} WHERE id = ?`,
            values
        );
    }

    /**
     * Log user activity
     * @param {number} userId - Database user ID
     * @param {string} platform - 'discord' or 'telegram'
     * @param {string} activityType - Type of activity
     * @param {number} points - Points earned
     */
    async logActivity(userId, platform, activityType, points) {
        await this.db.query(
            'INSERT INTO bip_activity_log (user_id, platform, activity_type, points_earned) VALUES (?, ?, ?, ?)',
            [userId, platform, activityType, points]
        );
    }

    /**
     * Main function to handle user activity and award BipCoins
     * @param {string} platform - 'discord' or 'telegram'
     * @param {string} userId - Platform user ID
     * @param {string} username - Platform username
     * @param {string} activityType - Type of activity ('message', 'voice', 'command')
     * @param {object} client - Discord/Telegram client for sending announcements
     * @returns {Promise<object>} Result of the operation
     */
    async handleUserActivity(platform, userId, username, activityType, client = null) {
        try {
            // Check cooldown - platform specific
            if (this.isOnCooldown(`${platform}:${userId}`)) {
                return { success: false, message: 'User is on cooldown' };
            }

            // Calculate base points
            const basePoints = this.config.BASE_POINTS[activityType.toUpperCase()] || 0;
            if (basePoints === 0) {
                return { success: false, message: 'Invalid activity type' };
            }

            // Get or create user record
            let user = await this.upsertPlatformUser(platform, userId, username);

            // Check streak
            const streakData = await this.checkStreak(user.id, user.last_activity_date);
            const streakBonus = streakData.isNewStreak ? this.config.BASE_POINTS.STREAK_BONUS : 0;
            const totalPoints = basePoints + streakBonus;

            // Update user's BipCoins and level
            const newCoins = user.bip_coins + totalPoints;
            const newLevel = this.calculateLevel(newCoins);
            
            // Update user in database
            await this.updateUser(user.id, {
                bip_coins: newCoins,
                level: newLevel,
                streak: streakData.streak,
                last_activity_date: streakData.currentDate
            });

            // Log activity
            await this.logActivity(user.id, platform, activityType, totalPoints);

            // Check for level up and assign roles (only for Discord)
            const levelUp = newLevel > user.level;
            if (levelUp && platform === 'discord' && client) {
                await this.handleLevelUp(user.discord_id, user.discord_username, newLevel, client);
            }

            // Set cooldown
            this.setCooldown(`${platform}:${userId}`);

            return { 
                success: true, 
                pointsEarned: totalPoints,
                newBalance: newCoins,
                newLevel,
                levelUp,
                streak: streakData.streak,
                streakExtended: streakData.isNewStreak
            };
        } catch (error) {
            logger.error(`Error in handleUserActivity: ${error}`);
            throw error;
        }
    }

    /**
     * Generate a verification code for account linking
     * @param {string} platform - 'discord' or 'telegram'
     * @param {string} userId - Platform user ID
     * @returns {string} Verification code
     */
    generateVerificationCode(platform, userId) {
        const code = crypto.randomBytes(3).toString('hex').toUpperCase(); // 6-character code
        this.verificationCodes.set(`${platform}:${userId}`, {
            code,
            expiresAt: Date.now() + this.config.VERIFICATION_CODE_EXPIRY
        });
        return code;
    }

    /**
     * Verify a code for account linking
     * @param {string} platform - 'discord' or 'telegram'
     * @param {string} userId - Platform user ID
     * @param {string} code - Verification code
     * @returns {boolean} True if code is valid
     */
    verifyCode(platform, userId, code) {
        const key = `${platform}:${userId}`;
        const record = this.verificationCodes.get(key);
        
        if (!record || record.expiresAt < Date.now()) {
            this.verificationCodes.delete(key);
            return false;
        }
        
        const isValid = record.code === code;
        if (isValid) this.verificationCodes.delete(key);
        return isValid;
    }

    /**
     * Start the account linking process
     * @param {string} platform - 'discord' or 'telegram'
     * @param {string} userId - Platform user ID
     * @param {string} username - Platform username
     * @param {object} client - Discord/Telegram client for sending verification
     * @returns {Promise<object>} Result of the operation
     */
    async startAccountLinking(platform, userId, username, client) {
        try {
            // Check if user already has both accounts linked
            const user = await this.getUserByPlatform(platform, userId);
            if (user && user.discord_id && user.telegram_id) {
                return { success: false, message: 'Your account is already linked' };
            }

            // Generate verification code
            const code = this.generateVerificationCode(platform, userId);

            // Send verification message
            if (platform === 'discord' && client) {
                const channel = await client.channels.fetch(this.config.CHANNELS.VERIFICATION);
                if (channel) {
                    await channel.send({
                        content: `To link your Telegram account, use this verification code in Telegram: \`${code}\``,
                        ephemeral: true
                    });
                }
            }
            // For Telegram, you would implement similar logic using Telegram bot API

            return { 
                success: true, 
                message: 'Verification code generated', 
                code: code // Normally you wouldn't return the code, just for testing
            };
        } catch (error) {
            logger.error(`Error in startAccountLinking: ${error}`);
            return { success: false, message: 'Failed to start account linking' };
        }
    }

    /**
     * Complete the account linking process
     * @param {string} platform - 'discord' or 'telegram'
     * @param {string} userId - Platform user ID
     * @param {string} username - Platform username
     * @param {string} code - Verification code
     * @returns {Promise<object>} Result of the operation
     */
    async completeAccountLinking(platform, userId, username, code) {
        try {
            // Verify the code
            if (!this.verifyCode(platform, userId, code)) {
                return { success: false, message: 'Invalid or expired verification code' };
            }

            // Get the other platform's user (the one that started the verification)
            const otherPlatform = platform === 'discord' ? 'telegram' : 'discord';
            const otherUser = await this.getUserByPlatform(otherPlatform, userId);
            
            if (!otherUser) {
                return { success: false, message: 'No account found to link with' };
            }

            // Merge accounts
            return await this.mergeAccounts(otherPlatform, otherUser.id, platform, userId, username);
        } catch (error) {
            logger.error(`Error in completeAccountLinking: ${error}`);
            return { success: false, message: 'Failed to complete account linking' };
        }
    }

    /**
     * Merge two platform accounts into one
     * @param {string} platform1 - First platform ('discord' or 'telegram')
     * @param {string} userId1 - First platform user ID
     * @param {string} platform2 - Second platform ('discord' or 'telegram')
     * @param {string} userId2 - Second platform user ID
     * @param {string} username2 - Second platform username
     * @returns {Promise<object>} Result of the operation
     */
    async mergeAccounts(platform1, userId1, platform2, userId2, username2) {
        try {
            // Get both user records
            const user1 = await this.getUserByPlatform(platform1, userId1);
            const user2 = await this.getUserByPlatform(platform2, userId2);

            if (!user1 && !user2) {
                return { success: false, message: 'No accounts found to merge' };
            }

            // Determine which user record to keep (prioritize the one with more activity)
            let primaryUser, secondaryUser;
            if (user1 && user2) {
                // Both exist - merge into the older account or the one with more points
                if (user1.bip_coins >= user2.bip_coins) {
                    primaryUser = user1;
                    secondaryUser = user2;
                } else {
                    primaryUser = user2;
                    secondaryUser = user1;
                }
            } else {
                primaryUser = user1 || user2;
            }

            // If we have two users to merge
            if (primaryUser && secondaryUser) {
                // Combine BipCoins
                const combinedCoins = primaryUser.bip_coins + secondaryUser.bip_coins;
                
                // Use the longer streak
                const combinedStreak = Math.max(primaryUser.streak, secondaryUser.streak);
                
                // Use the most recent activity date
                const primaryDate = new Date(primaryUser.last_activity_date || 0);
                const secondaryDate = new Date(secondaryUser.last_activity_date || 0);
                const combinedDate = primaryDate > secondaryDate ? 
                    primaryUser.last_activity_date : 
                    secondaryUser.last_activity_date;

                // Update primary user with combined data
                await this.updateUser(primaryUser.id, {
                    [`${platform2}_id`]: userId2,
                    [`${platform2}_username`]: username2,
                    bip_coins: combinedCoins,
                    streak: combinedStreak,
                    last_activity_date: combinedDate,
                    level: this.calculateLevel(combinedCoins)
                });

                // Migrate activity logs
                await this.db.query(
                    'UPDATE bip_activity_log SET user_id = ? WHERE user_id = ?',
                    [primaryUser.id, secondaryUser.id]
                );

                // Delete secondary user
                await this.db.query(
                    'DELETE FROM bip_users WHERE id = ?',
                    [secondaryUser.id]
                );

                return { 
                    success: true, 
                    message: 'Accounts merged successfully',
                    bipCoins: combinedCoins,
                    streak: combinedStreak
                };
            }

            // If we only have one user, just add the other platform info
            const platformToUpdate = primaryUser === user1 ? platform2 : platform1;
            const userIdToUpdate = primaryUser === user1 ? userId2 : userId1;
            const usernameToUpdate = primaryUser === user1 ? username2 : (user1.discord_username || user1.telegram_username);

            await this.updateUser(primaryUser.id, {
                [`${platformToUpdate}_id`]: userIdToUpdate,
                [`${platformToUpdate}_username`]: usernameToUpdate
            });

            return { 
                success: true, 
                message: 'Account linked successfully',
                bipCoins: primaryUser.bip_coins,
                streak: primaryUser.streak
            };
        } catch (error) {
            logger.error(`Error in mergeAccounts: ${error}`);
            return { success: false, message: 'Failed to merge accounts' };
        }
    }

    /**
     * Unlink a platform account
     * @param {string} platform - Platform to unlink ('discord' or 'telegram')
     * @param {string} userId - User ID on the platform to keep
     * @returns {Promise<object>} Result of the operation
     */
    async unlinkAccount(platform, userId) {
        try {
            const user = await this.getUserByPlatform(platform, userId);
            if (!user) {
                return { success: false, message: 'User not found' };
            }

            const otherPlatform = platform === 'discord' ? 'telegram' : 'discord';
            const otherId = user[`${otherPlatform}_id`];
            const otherUsername = user[`${otherPlatform}_username`];

            if (!otherId) {
                return { success: false, message: 'No linked account to unlink' };
            }

            // Create a new account for the unlinked platform
            await this.db.query(
                `INSERT INTO bip_users (${otherPlatform}_id, ${otherPlatform}_username, bip_coins, level, streak, last_activity_date)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [otherId, otherUsername, user.bip_coins, user.level, user.streak, user.last_activity_date]
            );

            // Migrate activity logs for the other platform
            const [otherUser] = await this.db.query(
                `SELECT id FROM bip_users WHERE ${otherPlatform}_id = ?`,
                [otherId]
            );

            if (otherUser && otherUser.id) {
                await this.db.query(
                    `UPDATE bip_activity_log SET user_id = ? 
                     WHERE user_id = ? AND platform = ?`,
                    [otherUser.id, user.id, otherPlatform]
                );
            }

            // Remove the unlinked platform from the original user
            await this.updateUser(user.id, {
                [`${otherPlatform}_id`]: null,
                [`${otherPlatform}_username`]: null
            });

            return { success: true, message: 'Account unlinked successfully' };
        } catch (error) {
            logger.error(`Error in unlinkAccount: ${error}`);
            return { success: false, message: 'Failed to unlink account' };
        }
    }

    /**
     * Get linked accounts information
     * @param {string} platform - 'discord' or 'telegram'
     * @param {string} userId - Platform user ID
     * @returns {Promise<object>} Linked accounts info
     */
    async getLinkedAccounts(platform, userId) {
        const user = await this.getUserByPlatform(platform, userId);
        if (!user) {
            return { success: false, message: 'User not found' };
        }

        return {
            success: true,
            discordLinked: !!user.discord_id,
            telegramLinked: !!user.telegram_id,
            discordUsername: user.discord_username,
            telegramUsername: user.telegram_username
        };
    }

    /**
     * Add or update a role in the database
     * @param {string} discordRoleId - Discord role ID
     * @param {number} levelRequirement - Level required to get this role
     * @param {string} description - Role description
     */
    async upsertRole(discordRoleId, levelRequirement, description) {
        await this.db.query(`
            INSERT INTO bip_roles (discord_role_id, level_requirement, description)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE
                level_requirement = VALUES(level_requirement),
                description = VALUES(description)
        `, [discordRoleId, levelRequirement, description]);
    }

    /**
     * Remove a role from the database
     * @param {string} discordRoleId - Discord role ID
     */
    async removeRole(discordRoleId) {
        await this.db.query(
            'DELETE FROM bip_roles WHERE discord_role_id = ?',
            [discordRoleId]
        );
    }

    /**
     * Get all roles from the database
     * @returns {Promise<array>} Array of role objects
     */
    async getAllRoles() {
        const [rows] = await this.db.query(
            'SELECT * FROM bip_roles ORDER BY level_requirement ASC'
        );
        return rows;
    }

    /**
     * Get roles for a specific level
     * @param {number} level - User level
     * @returns {Promise<array>} Array of role objects
     */
    async getRolesForLevel(level) {
        const [rows] = await this.db.query(
            'SELECT * FROM bip_roles WHERE level_requirement <= ? ORDER BY level_requirement ASC',
            [level]
        );
        return rows;
    }

    /**
     * Check and update user streak
     * @param {number} userId - Database user ID
     * @param {string|null} lastActivityDate - Last activity date from DB
     * @returns {Promise<object>} Streak data
     */
    async checkStreak(userId, lastActivityDate) {
        const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        if (!lastActivityDate) {
            // First activity - start streak
            return { streak: 1, isNewStreak: true, currentDate };
        }

        if (lastActivityDate === currentDate) {
            // Already active today - no streak change
            const [user] = await this.db.query(
                'SELECT streak FROM bip_users WHERE id = ?',
                [userId]
            );
            return { streak: user.streak, isNewStreak: false, currentDate };
        }

        if (lastActivityDate === yesterdayStr) {
            // Continuing streak
            const [user] = await this.db.query(
                'SELECT streak FROM bip_users WHERE id = ?',
                [userId]
            );
            const newStreak = user.streak + 1;
            return { streak: newStreak, isNewStreak: true, currentDate };
        }

        // Streak broken - reset to 1
        return { streak: 1, isNewStreak: true, currentDate };
    }

    /**
     * Handle level up events (role assignment, announcements)
     * @param {string} discordId - Discord user ID
     * @param {string} username - Discord username
     * @param {number} newLevel - New level
     * @param {object} client - Discord client
     */
    async handleLevelUp(discordId, username, newLevel, client) {
        try {
            if (!discordId || !client) return;

            // Get all roles the user should have at this level
            const roles = await this.getRolesForLevel(newLevel);
            
            // Assign all eligible roles
            for (const role of roles) {
                await this.assignRole(discordId, role.discord_role_id, client);
            }

            // Send announcement
            await this.sendAnnouncement(
                client, 
                discordId, 
                'LEVEL_UP', 
                { username, level: newLevel }
            );
        } catch (error) {
            logger.error(`Error in handleLevelUp: ${error}`);
        }
    }

    /**
     * Assign role to user (Discord specific)
     * @param {string} userId - Discord user ID
     * @param {string} roleId - Role ID
     * @param {object} client - Discord client
     */
    async assignRole(userId, roleId, client) {
        try {
            const guild = client.guilds.cache.first(); // Adjust based on your needs
            const member = await guild.members.fetch(userId);
            const role = await guild.roles.fetch(roleId);
            
            if (member && role && !member.roles.cache.has(role.id)) {
                await member.roles.add(role);
            }
        } catch (error) {
            logger.error(`Error assigning role: ${error}`);
        }
    }

    /**
     * Remove role from user (Discord specific)
     * @param {string} userId - Discord user ID
     * @param {string} roleId - Role ID
     * @param {object} client - Discord client
     */
    async removeRoleFromUser(userId, roleId, client) {
        try {
            const guild = client.guilds.cache.first(); // Adjust based on your needs
            const member = await guild.members.fetch(userId);
            const role = await guild.roles.fetch(roleId);
            
            if (member && role && member.roles.cache.has(role.id)) {
                await member.roles.remove(role);
            }
        } catch (error) {
            logger.error(`Error removing role: ${error}`);
        }
    }

    /**
     * Send announcement (Discord specific)
     * @param {object} client - Discord client
     * @param {string} userId - User ID
     * @param {string} type - Announcement type
     * @param {object} data - Additional data
     */
    async sendAnnouncement(client, userId, type, data) {
        try {
            const channel = await client.channels.fetch(this.config.CHANNELS.ANNOUNCEMENTS);
            if (!channel) return;

            let message;
            switch (type) {
                case 'LEVEL_UP':
                    message = `🎉 Congratulations <@${userId}>! You've reached level ${data.level}!`;
                    break;
                case 'STREAK':
                    message = `🔥 <@${userId}> is on a ${data.streak}-day streak! Keep it up!`;
                    break;
                case 'STREAK_BROKEN':
                    message = `😢 <@${userId}>'s ${data.streak}-day streak has ended. Start a new one today!`;
                    break;
                default:
                    return;
            }

            await channel.send(message);
        } catch (error) {
            logger.error(`Error sending announcement: ${error}`);
        }
    }

    /**
     * Calculate level based on BipCoins
     * @param {number} bipCoins - Number of BipCoins
     * @returns {number} Level
     */
    calculateLevel(bipCoins) {
        let level = 1;
        while (bipCoins >= this.config.XP_PER_LEVEL(level)) {
            level++;
        }
        return level - 1; // Return the highest level achieved
    }

    /**
     * Calculate BipCoins needed for a specific level
     * @param {number} level - Target level
     * @returns {number} BipCoins needed
     */
    calculateBipCoinsForLevel(level) {
        return this.config.XP_PER_LEVEL(level);
    }

    /**
     * Check if user is on cooldown
     * @param {string} key - Cooldown key (platform:userId)
     * @returns {boolean} True if on cooldown
     */
    isOnCooldown(key) {
        const cooldown = this.cooldowns.get(key);
        if (!cooldown) return false;
        
        return Date.now() < cooldown;
    }

    /**
     * Set cooldown for user
     * @param {string} key - Cooldown key (platform:userId)
     */
    setCooldown(key) {
        this.cooldowns.set(key, Date.now() + this.config.COOLDOWN_TIME);
    }

    /**
     * Get user rank information
     * @param {string} platform - 'discord' or 'telegram'
     * @param {string} userId - Platform user ID
     * @returns {Promise<object>} User rank data
     */
    async getUserRank(platform, userId) {
        let user = await this.getUserByPlatform(platform, userId);
        if (!user) return null;

        // Get rank position
        const [rankRows] = await this.db.query(
            `SELECT COUNT(*) + 1 as rank 
             FROM bip_users 
             WHERE bip_coins > ?`,
            [user.bip_coins]
        );

        // Get total users
        const [totalRows] = await this.db.query(
            'SELECT COUNT(*) as total FROM bip_users'
        );

        return {
            username: user.discord_username || user.telegram_username,
            bipCoins: user.bip_coins,
            level: user.level,
            streak: user.streak,
            rank: rankRows[0].rank,
            totalUsers: totalRows[0].total,
            nextLevelXp: this.calculateBipCoinsForLevel(user.level + 1),
            currentLevelXp: this.calculateBipCoinsForLevel(user.level),
            xpProgress: user.bip_coins - this.calculateBipCoinsForLevel(user.level),
            xpNeeded: this.calculateBipCoinsForLevel(user.level + 1) - 
                      this.calculateBipCoinsForLevel(user.level)
        };
    }

    /**
     * Get leaderboard
     * @param {number} limit - Number of users to return
     * @returns {Promise<array>} Leaderboard data
     */
    async getLeaderboard(limit = 10) {
        const [rows] = await this.db.query(
            `SELECT id, discord_id, discord_username, telegram_id, telegram_username, 
                    bip_coins, level, streak 
             FROM bip_users 
             ORDER BY bip_coins DESC 
             LIMIT ?`,
            [limit]
        );
        return rows;
    }

    /**
     * Create Discord embed for rank display
     * @param {object} rankData - User rank data
     * @returns {EmbedBuilder} Discord embed
     */
    createRankEmbed(rankData) {
        if (!rankData) {
            return new EmbedBuilder()
                .setColor('#FF0000')
                .setDescription('User not found in the BipCoin system');
        }

        const progress = (rankData.xpProgress / rankData.xpNeeded) * 100;
        const progressBar = this.createProgressBar(progress);

        const embed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle(`${rankData.username}'s BipCoin Stats`)
            .addFields(
                { name: 'Rank', value: `${rankData.rank}/${rankData.totalUsers}`, inline: true },
                { name: 'Level', value: rankData.level.toString(), inline: true },
                { name: 'Streak', value: `${rankData.streak} days`, inline: true },
                { name: 'BipCoins', value: rankData.bipCoins.toString(), inline: true },
                { name: 'Progress to Next Level', value: `${progressBar} ${Math.round(progress)}%`, inline: false },
                { name: 'XP Needed', value: `${rankData.xpProgress}/${rankData.xpNeeded}`, inline: false }
            )
            .setFooter({ text: 'Keep being active to earn more BipCoins!' });

        return embed;
    }

    /**
     * Create a progress bar string
     * @param {number} percentage - Progress percentage (0-100)
     * @param {number} length - Length of the progress bar
     * @returns {string} Progress bar string
     */
    createProgressBar(percentage, length = 10) {
        const filled = Math.round(length * (percentage / 100));
        const empty = length - filled;
        return `[${'█'.repeat(filled)}${'░'.repeat(empty)}]`;
    }

    /**
     * Admin function to manually adjust BipCoins
     * @param {string} platform - 'discord' or 'telegram'
     * @param {string} userId - Platform user ID
     * @param {number} amount - Amount to adjust (can be negative)
     * @returns {Promise<object>} Result of the operation
     */
    async adjustBipCoins(platform, userId, amount) {
        try {
            let user = await this.getUserByPlatform(platform, userId);
            if (!user) {
                return { success: false, message: 'User not found' };
            }

            const newAmount = user.bip_coins + amount;
            if (newAmount < 0) {
                return { success: false, message: 'Resulting amount cannot be negative' };
            }

            const newLevel = this.calculateLevel(newAmount);
            await this.updateUser(user.id, {
                bip_coins: newAmount,
                level: newLevel
            });

            return { 
                success: true, 
                newBalance: newAmount,
                newLevel,
                levelUp: newLevel > user.level
            };
        } catch (error) {
            logger.error(`Error adjusting BipCoins: ${error}`);
            return { success: false, message: 'Internal server error' };
        }
    }

    /**
     * Admin function to reset user data
     * @param {string} platform - 'discord' or 'telegram'
     * @param {string} userId - Platform user ID
     * @returns {Promise<object>} Result of the operation
     */
    async resetUser(platform, userId) {
        try {
            const user = await this.getUserByPlatform(platform, userId);
            if (!user) {
                return { success: false, message: 'User not found' };
            }

            await this.db.query(
                'DELETE FROM bip_users WHERE id = ?',
                [user.id]
            );
            
            await this.db.query(
                'DELETE FROM bip_activity_log WHERE user_id = ?',
                [user.id]
            );

            return { success: true, message: 'User data reset successfully' };
        } catch (error) {
            logger.error(`Error resetting user: ${error}`);
            return { success: false, message: 'Internal server error' };
        }
    }
}

module.exports = BipCoinSystem;
