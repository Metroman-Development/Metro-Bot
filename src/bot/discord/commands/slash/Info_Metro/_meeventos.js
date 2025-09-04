const { SlashCommandSubcommandBuilder, EmbedBuilder } = require('discord.js');
const moment = require('moment-timezone');
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
        activeEvent: '🎪 **EVENTO ACTIVO**',
        upcomingEvent: '📅 **PRÓXIMO EVENTO**',
        date: '🗓️ Fecha',
        hours: '⏰ Horario',
        normalHours: 'Horario normal',
        extendedHours: 'Horario extendido',
        affectedLines: '🚇 Líneas afectadas',
        entryStations: '📥 Estaciones de entrada',
        exitStations: '📤 Estaciones de salida',
        notes: '📝 Notas',
        otherEvents: '📌 Otros eventos programados',
        updated: 'ℹ️ Actualizado',
        noEvents: '✅ No hay eventos programados',
        error: '❌ Error al obtener información de eventos'
    }
};

module.exports = {
    data: new SlashCommandSubcommandBuilder()
        .setName('eventos')
        .setDescription('Muestra información sobre eventos especiales que afectan el servicio'),

    async run(interaction) {
        await interaction.deferReply();

        const now = TimeHelpers.currentTime;
        const today = now.format('YYYY-MM-DD');

        const currentEvent = TimeHelpers.getCurrentEvent();
        const upcomingEvents = TimeHelpers.events
            .filter(event => event.date >= today)
            .sort((a, b) => new Date(a.date) - new Date(b.date));

        if (!currentEvent && upcomingEvents.length === 0) {
            return interaction.editReply(spanishDict.ui.noEvents);
        }

        const embed = new EmbedBuilder()
            .setColor(currentEvent ? '#FF5555' : '#5555FF')
            .setFooter({
                text: `${spanishDict.ui.updated}: ${now.format('DD/MM HH:mm')}`
            });

        const formatSpanishDate = (date) => {
            const dayName = spanishDict.days[date.format('dddd').toLowerCase()];
            const dayNumber = date.format('D');
            const monthName = spanishDict.months[date.format('MMMM').toLowerCase()];
            return `${dayName}, ${dayNumber} de ${monthName}`;
        };

        if (currentEvent) {
            const eventDate = moment(currentEvent.date);
            const dayHelper = Object.create(TimeHelpers);
            Object.assign(dayHelper, TimeHelpers);
            dayHelper.currentTime = eventDate.clone();
            const operatingHours = dayHelper.getOperatingHours();

            embed.setTitle(`🎪 ${currentEvent.name}`)
                .setDescription(spanishDict.ui.activeEvent)
                .addFields(
                    {
                        name: spanishDict.ui.date,
                        value: formatSpanishDate(eventDate),
                        inline: true
                    },
                    {
                        name: spanishDict.ui.hours,
                        value: currentEvent.extendedHours?.closing
                            ? `${spanishDict.ui.normalHours}: ${operatingHours.opening} - ${operatingHours.closing}\n${spanishDict.ui.extendedHours}: ${operatingHours.opening} - ${currentEvent.extendedHours.closing}`
                            : `${spanishDict.ui.normalHours}: ${operatingHours.opening} - ${operatingHours.closing}`,
                        inline: true
                    }
                );

            if (currentEvent.affectedLines?.length > 0) {
                embed.addFields({
                    name: spanishDict.ui.affectedLines,
                    value: currentEvent.affectedLines.map(line =>
                        config.linesEmojis[line.toLowerCase()] || line
                    ).join(', '),
                    inline: true
                });
            }

            if (currentEvent.operationalStations?.length > 0) {
                embed.addFields({
                    name: spanishDict.ui.entryStations,
                    value: currentEvent.operationalStations.join(', '),
                    inline: false
                });
            }

            if (currentEvent.closedStations && Object.keys(currentEvent.closedStations).length > 0) {
                let stationsText = '';
                for (const [line, stations] of Object.entries(currentEvent.closedStations)) {
                    stationsText += `▸ ${config.linesEmojis[line.toLowerCase()] || line}: ${stations.join(', ')}\n`;
                }
                embed.addFields({
                    name: spanishDict.ui.exitStations,
                    value: stationsText,
                    inline: false
                });
            }

            if (currentEvent.notes) {
                embed.addFields({
                    name: spanishDict.ui.notes,
                    value: currentEvent.notes,
                    inline: false
                });
            }

            if (upcomingEvents.length > 0) {
                const otherEventsText = upcomingEvents
                    .map(e => `▸ ${e.name} (${moment(e.date).format('DD/MM')})`)
                    .join('\n');

                embed.addFields({
                    name: spanishDict.ui.otherEvents,
                    value: otherEventsText,
                    inline: false
                });
            }
        }
        else {
            const nextEvent = upcomingEvents[0];
            const eventDate = moment(nextEvent.date);
            const dayHelper = Object.create(TimeHelpers);
            Object.assign(dayHelper, TimeHelpers);
            dayHelper.currentTime = eventDate.clone();

            const operatingHours = dayHelper.getOperatingHours();

            embed.setTitle(`🎪 ${nextEvent.name}`)
                .setDescription(spanishDict.ui.upcomingEvent)
                .addFields(
                    {
                        name: spanishDict.ui.date,
                        value: formatSpanishDate(eventDate),
                        inline: true
                    },
                    {
                        name: spanishDict.ui.hours,
                        value: nextEvent.extendedHours?.closing
                            ? `${spanishDict.ui.normalHours}: ${operatingHours.opening} - ${operatingHours.closing}\n${spanishDict.ui.extendedHours}: ${operatingHours.opening} - ${nextEvent.extendedHours.closing}`
                            : `${spanishDict.ui.normalHours}: ${operatingHours.opening} - ${operatingHours.closing}`,
                        inline: true
                    }
                );

            if (nextEvent.affectedLines?.length > 0) {
                embed.addFields({
                    name: spanishDict.ui.affectedLines,
                    value: nextEvent.affectedLines.map(line =>
                        config.linesEmojis[line.toLowerCase()] || line
                    ).join(', '),
                    inline: true
                });
            }

            if (nextEvent.inStations?.length > 0) {
                embed.addFields({
                    name: spanishDict.ui.entryStations,
                    value: nextEvent.inStations.join(', '),
                    inline: false
                });
            }

            if (nextEvent.outStations && Object.keys(nextEvent.outStations).length > 0) {
                let stationsText = '';
                for (const [line, stations] of Object.entries(nextEvent.outStations)) {
                    stationsText += `▸ ${config.linesEmojis[line.toLowerCase()] || line}: ${stations.join(', ')}\n`;
                }
                embed.addFields({
                    name: spanishDict.ui.exitStations,
                    value: stationsText,
                    inline: false
                });
            }

            if (nextEvent.notes) {
                embed.addFields({
                    name: spanishDict.ui.notes,
                    value: nextEvent.notes,
                    inline: false
                });
            }

            if (upcomingEvents.length > 1) {
                const otherEventsText = upcomingEvents
                    .slice(1)
                    .map(e => `▸ ${e.name} (${moment(e.date).format('DD/MM')})`)
                    .join('\n');

                embed.addFields({
                    name: spanishDict.ui.otherEvents,
                    value: otherEventsText,
                    inline: false
                });
            }
        }

        await interaction.editReply({ embeds: [embed] });
    }
};