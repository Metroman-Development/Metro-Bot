const { SlashCommandBuilder } = require('@discordjs/builders');
const { PermissionsBitField } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
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
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
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
            // If a line is specified, we need to find the correct station_id for that line.
            // This is a simplified example. In a real application, you would query the database
            // to get the station_id based on the station code and line.
            // For now, we'll just append the line to the targetId.
            targetId = `${targetId}-${line}`;
        }


        try {
            await overrideManager.addScheduledOverride({
                targetType,
                targetId,
                status,
                message,
                source,
                startAt,
                endAt
            });

            await interaction.reply({
                content: 'Scheduled override added successfully.',
                ephemeral: true
            });
        } catch (error) {
            console.error(error);
            await interaction.reply({
                content: 'There was an error while adding the scheduled override.',
                ephemeral: true
            });
        }
    }
};
