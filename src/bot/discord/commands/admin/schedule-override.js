const { SlashCommandBuilder } = require('@discordjs/builders');
const { PermissionsBitField } = require('discord.js');
const BaseCommand = require('../BaseCommand');

class ScheduleOverrideCommand extends BaseCommand {
    constructor() {
        super(new SlashCommandBuilder()
            .setName('schedule-override')
            .setDescription('Schedules a status override for a line, station, or the entire system.')
            .addStringOption(option =>
                option.setName('target_type')
                    .setDescription('The type of target to override.')
                    .setRequired(true)
                    .addChoices(
                        { name: 'Line', value: 'line' },
                        { name: 'Station', value: 'station' },
                        { name: 'System', value: 'system' }
                    ))
            .addStringOption(option =>
                option.setName('target_id')
                    .setDescription('The ID of the target to override.')
                    .setRequired(true))
            .addStringOption(option =>
                option.setName('status')
                    .setDescription('The status to set.')
                    .setRequired(true))
            .addStringOption(option =>
                option.setName('message')
                    .setDescription('The message to display for the override.')
                    .setRequired(true))
            .addStringOption(option =>
                option.setName('source')
                    .setDescription('The source of the override.')
                    .setRequired(true))
            .addStringOption(option =>
                option.setName('start_at')
                    .setDescription('The start time for the override (YYYY-MM-DDTHH:MM:SS).')
                    .setRequired(true))
            .addStringOption(option =>
                option.setName('end_at')
                    .setDescription('The end time for the override (YYYY-MM-DDTHH:MM:SS).')
                    .setRequired(true))
            .addStringOption(option =>
                option.setName('line')
                    .setDescription('The line of the station to override (for transfer stations).'))
            .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
        );
    }

    async execute(interaction) {
        const targetType = interaction.options.getString('target_type');
        let targetId = interaction.options.getString('target_id');
        const status = interaction.options.getString('status');
        const message = interaction.options.getString('message');
        const source = interaction.options.getString('source');
        const startAt = interaction.options.getString('start_at');
        const endAt = interaction.options.getString('end_at');
        const line = interaction.options.getString('line');

        const overrideManager = interaction.client.metro._subsystems.overrideManager;

        if (targetType === 'station' && line) {
            targetId = `${targetId}-${line}`;
        }

        await interaction.deferReply();
        await overrideManager.addScheduledOverride({
            targetType,
            targetId,
            status,
            message,
            source,
            startAt,
            endAt
        });

        await interaction.editReply({
            content: 'Scheduled override added successfully.'
        });
    }
}

module.exports = new ScheduleOverrideCommand();
