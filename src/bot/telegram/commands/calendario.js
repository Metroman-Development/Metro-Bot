const TimeHelpers = require('../../../utils/timeHelpers');
const config = require('../../../config/metro/metroConfig');

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
};

function formatDayList(days) {
    if (days.length === 1) return days[0];
    if (days.length === 2) return days.join(' y ');
    const allButLast = days.slice(0, -1).join(', ');
    const lastDay = days[days.length - 1];
    return `${allButLast} y ${lastDay}`;
}

module.exports = {
  execute: async (ctx) => {
    const args = ctx.message.text.split(' ').slice(1);
    const viewType = args[0] || 'semana';

    if (viewType === 'semana') {
      const now = new TimeHelpers().currentTime.clone();
      const weekStart = now.clone().startOf('isoWeek');
      const weekEnd = weekStart.clone().add(6, 'days');

      const dateRange = `Desde el ${weekStart.date()} de ${spanishDict.months[weekStart.format('MMMM').toLowerCase()]} hasta el ${weekEnd.date()} de ${spanishDict.months[weekEnd.format('MMMM').toLowerCase()]}`;

      const days = Array.from({ length: 7 }, (_, i) => weekStart.clone().add(i, 'days'));
      const dailySchedules = days.map(date => {
          const dayHelper = new TimeHelpers(date.clone());
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

      let response = `**Horario Semanal Agrupado**\n${dateRange}\n\n`;
      scheduleGroups.forEach(group => {
          const formattedDays = formatDayList(group.days);
          const extension = group.isExtended ? ' (Extensión)' : '';
          const hours = `${group.opening} - ${group.closing}`;

          let entry = `**${formattedDays}${extension}**\n${hours}`;

          if (group.affectedLines.length > 0) {
              const lines = group.affectedLines.map(l => config.linesEmojis[l.toLowerCase()] || l).join(', ');
              entry += `\nLíneas afectadas: ${lines}`;
          }

          response += entry + '\n\n';
      });

      await ctx.replyWithMarkdown(response);
    } else {
      await ctx.reply('Vista de calendario no válida. Tipos válidos: semana.');
    }
  },
  description: 'Muestra el calendario del Metro.',
};
