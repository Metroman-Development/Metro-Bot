const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const moment = require('moment-timezone');
const TimeHelpers = require('../../../../../core/chronos/timeHelpers');
const config = require('../../../../../config/metro/metroConfig');

// Complete Spanish dictionary with proper capitalization
const spanishDict = {
    days: {
        monday: 'Lunes',
        tuesday: 'Martes',
        wednesday: 'Miércoles',
        thursday: 'Jueves',
        friday: 'Viernes',
        saturday: 'Sábado',
        sunday: 'Domingo'
    },
    months: {
        january: 'Enero',
        february: 'Febrero',
        march: 'Marzo',
        april: 'Abril',
        may: 'Mayo',
        june: 'Junio',
        july: 'Julio',
        august: 'Agosto',
        september: 'Septiembre',
        october: 'Octubre',
        november: 'Noviembre',
        december: 'Diciembre'
    },
    ui: {
        title: '📅 Horario Semanal Agrupado',
        dateRange: 'Desde el {startDay} de {startMonth} hasta el {endDay} de {endMonth}',
        scheduleTitle: 'Horario y Eventos',
        hoursFormat: '⏰ {open} - {close}',
        affectedLines: '🚇 Líneas afectadas: {lines}',
        extension: ' (Extensión)',
        updated: 'ℹ️ Actualizado: {date}',
        error: '❌ Error al generar el horario semanal',
        daySeparator: ' • ' // Added proper day separator
    }
};

// Format day list with proper Spanish formatting
function formatDayList(days) {
    // Handle single day
    if (days.length === 1) return days[0];
    
    // Handle multiple days with proper Spanish formatting
    if (days.length === 2) return days.join(' y ');
    
    // For 3+ days, use Oxford comma style
    const allButLast = days.slice(0, -1).join(', ');
    const lastDay = days[days.length - 1];
    return `${allButLast} y ${lastDay}`;
}

module.exports = {
    parentCommand: 'calendario-metro',
    data: (subcommand) => subcommand
        .setName('semana')
        .setDescription('Muestra el horario semanal agrupado con eventos extendidos'),

    async execute(interaction) {
        try {
            await interaction.deferReply();
            const now = TimeHelpers.currentTime.clone();

            // 1. Get week range with proper Spanish formatting
            const weekStart = now.clone().startOf('isoWeek');
            const weekEnd = weekStart.clone().add(6, 'days');

            // Format date range with capitalized month names
            const dateRange = spanishDict.ui.dateRange
                .replace('{startDay}', weekStart.date())
                .replace('{startMonth}', spanishDict.months[weekStart.format('MMMM').toLowerCase()])
                .replace('{endDay}', weekEnd.date())
                .replace('{endMonth}', spanishDict.months[weekEnd.format('MMMM').toLowerCase()]);

            // 2. Process each day's schedule with Spanish names
            const days = Array.from({ length: 7 }, (_, i) => weekStart.clone().add(i, 'days'));
            const dailySchedules = days.map(date => {
                const dayHelper = Object.create(TimeHelpers);
                Object.assign(dayHelper, TimeHelpers);
                dayHelper.currentTime = date.clone();
                
                const event = dayHelper.getEventDetails();
                const operatingHours = dayHelper.getOperatingHours();

                return {
                    date,
                    name: spanishDict.days[date.format('dddd').toLowerCase()],
                    shortName: spanishDict.days[date.format('dddd').toLowerCase()],
                    opening: operatingHours.opening,
                    closing: event?.extendedHours?.closing || operatingHours.closing,
                    isExtended: !!event?.extendedHours,
                    affectedLines: event?.affectedLines || []
                };
            });

            // 3. Group days with identical schedules
            const scheduleGroups = [];
            let currentGroup = {
                days: [dailySchedules[0].shortName],
                opening: dailySchedules[0].opening,
                closing: dailySchedules[0].closing,
                isExtended: dailySchedules[0].isExtended,
                affectedLines: dailySchedules[0].affectedLines
            };

            for (let i = 1; i < dailySchedules.length; i++) {
                const day = dailySchedules[i];
                if (day.opening === currentGroup.opening &&
                    day.closing === currentGroup.closing &&
                    day.isExtended === currentGroup.isExtended &&
                    JSON.stringify(day.affectedLines) === JSON.stringify(currentGroup.affectedLines)) {
                    currentGroup.days.push(day.shortName);
                } else {
                    scheduleGroups.push(currentGroup);
                    currentGroup = {
                        days: [day.shortName],
                        opening: day.opening,
                        closing: day.closing,
                        isExtended: day.isExtended,
                        affectedLines: day.affectedLines
                    };
                }
            }
            scheduleGroups.push(currentGroup);

            // 4. Build the embed with proper Spanish formatting
            const mainEmbed = new EmbedBuilder()
                .setTitle(spanishDict.ui.title)
                .setColor('#005BA6')
                .setDescription(dateRange);

            // 5. Add schedule groups with properly formatted day lists
            let scheduleDescription = '';
            scheduleGroups.forEach(group => {
                const formattedDays = formatDayList(group.days);
                const extension = group.isExtended ? spanishDict.ui.extension : '';
                const hours = spanishDict.ui.hoursFormat
                    .replace('{open}', group.opening)
                    .replace('{close}', group.closing);
                
                let entry = `**${formattedDays}${extension}**\n${hours}`;
                
                if (group.affectedLines.length > 0) {
                    const lines = group.affectedLines.map(l => config.linesEmojis[l.toLowerCase()] || l).join(', ');
                    entry += `\n${spanishDict.ui.affectedLines.replace('{lines}', lines)}`;
                }
                
                scheduleDescription += entry + '\n\n';
            });

            mainEmbed.addFields({
                name: spanishDict.ui.scheduleTitle,
                value: scheduleDescription.trim(),
                inline: false
            });

            // 6. Add footer with Spanish date format
            mainEmbed.setFooter({
                text: spanishDict.ui.updated.replace('{date}', now.format('DD/MM HH:mm'))
            });

            await interaction.editReply({ embeds: [mainEmbed] });

        } catch (error) {
            console.error('Error en /metro semana:', error);
            await interaction.editReply({
                content: spanishDict.ui.error,
                ephemeral: true
            });
        }
    }
};