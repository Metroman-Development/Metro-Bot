const { SlashCommandSubcommandBuilder, EmbedBuilder } = require('discord.js');
const TimeHelpers = require('../../../../../utils/timeHelpers');
const config = require('../../../../../config/metro/metroConfig');

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
        daySeparator: ' • '
    }
};

module.exports = {
    data: new SlashCommandSubcommandBuilder()
        .setName('semana')
        .setDescription('Muestra el horario semanal agrupado con eventos extendidos'),

    async execute(interaction) {
        await interaction.deferReply();
        const now = TimeHelpers.currentTime.clone();
        const weekStart = now.clone().startOf('isoWeek');
        const weekEnd = weekStart.clone().add(6, 'days');

        const dateRange = spanishDict.ui.dateRange
            .replace('{startDay}', weekStart.date())
            .replace('{startMonth}', spanishDict.months[weekStart.format('MMMM').toLowerCase()])
            .replace('{endDay}', weekEnd.date())
            .replace('{endMonth}', spanishDict.months[weekEnd.format('MMMM').toLowerCase()]);

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

        const mainEmbed = new EmbedBuilder()
            .setTitle(spanishDict.ui.title)
            .setColor('#005BA6')
            .setDescription(dateRange);

        let scheduleDescription = '';
        scheduleGroups.forEach(group => {
            const formattedDays = this.formatDayList(group.days);
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

        mainEmbed.setFooter({
            text: spanishDict.ui.updated.replace('{date}', now.format('DD/MM HH:mm'))
        });

        await interaction.editReply({ embeds: [mainEmbed] });
    },

    formatDayList(days) {
        if (days.length === 1) return days[0];
        if (days.length === 2) return days.join(' y ');
        const allButLast = days.slice(0, -1).join(', ');
        const lastDay = days[days.length - 1];
        return `${allButLast} y ${lastDay}`;
    }
};