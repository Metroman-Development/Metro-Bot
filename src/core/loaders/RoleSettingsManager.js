const { CacheManager } = require('../cache/CacheManager');
const logger = require('../../events/logger');

class RoleSettingsManager {
    constructor() {
        this.cache = CacheManager
            ;
        this.config = require('../../config/slashConfig.json').roleSettings;
    }

    async getRoleSettings(member) {
        const cacheKey = `roleSettings:${member.id}`;
        return await this.cache.wrap(
            'roleSettings',
            cacheKey,
            () => this.calculateRoleSettings(member),
            300000 // 5 minute cache
        );
    }

    calculateRoleSettings(member) {
        const settings = {
            cooldownMultiplier: 1.0,
            ignoreCooldowns: false,
            bypassRestrictions: false,
            commandSpecific: {}
        };

        // Apply role bonuses (highest priority role takes precedence)
        member.roles.cache.forEach(role => {
            const roleConfig = this.config[role.id];
            if (!roleConfig) return;

            // Apply global multipliers
            if (roleConfig.cooldownMultiplier) {
                settings.cooldownMultiplier = Math.min(
                    settings.cooldownMultiplier,
                    roleConfig.cooldownMultiplier
                );
            }

            // Apply boolean flags
            if (roleConfig.ignoreCooldowns) {
                settings.ignoreCooldowns = true;
            }
            if (roleConfig.bypassRestrictions) {
                settings.bypassRestrictions = true;
            }

            // Apply command-specific settings
            if (roleConfig.commandLimits) {
                Object.assign(settings.commandSpecific, roleConfig.commandLimits);
            }
        });

        return settings;
    }

    async getEffectiveCooldown(member, commandName, subcommand = null) {
        const commandConfig = this.getCommandConfig(commandName, subcommand);
        const roleSettings = await this.getRoleSettings(member);

        if (roleSettings.ignoreCooldowns) return 0;

        const baseCooldown = subcommand 
            ? commandConfig.subcommands?.[subcommand]?.baseCooldown 
            : commandConfig.baseCooldown;

        let effectiveCooldown = baseCooldown * roleSettings.cooldownMultiplier;

        // Apply role-specific overrides
        for (const roleId of member.roles.cache.keys()) {
            const override = commandConfig.roleOverrides?.[roleId];
            if (override?.cooldown !== undefined) {
                effectiveCooldown = override.cooldown;
                break; // Highest priority role wins
            }
        }

        return Math.floor(effectiveCooldown);
    }

    async canBypassRestriction(member, restrictionType) {
        const roleSettings = await this.getRoleSettings(member);
        return roleSettings.bypassRestrictions;
    }

    getCommandConfig(commandName, subcommand = null) {
        const config = require('../../config/slashConfig.json');
        return {
            ...config.commands[commandName],
            subcommands: subcommand ? {
                [subcommand]: config.commands[commandName]?.subcommands?.[subcommand]
            } : null
        };
    }
}

module.exports = new RoleSettingsManager();