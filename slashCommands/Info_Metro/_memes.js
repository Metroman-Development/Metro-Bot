const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const moment = require('moment-timezone');
const TimeHelpers = require('../../modules/chronos/timeHelpers');
const config = require('../../config/metro/metroConfig');

// Spanish translations
const translations = {
    title: '📅 Calendario Mensual del Metro',
    month: '🗓️ Mes',
    festiveDays: '🎉 Días festivos',
    noFestiveDays: 'Ningún día festivo este mes',
    eventsTitle: '📌 Eventos Destacados',
    noEvents: 'No hay eventos programados este mes',
    closingTime: '⏰ Cierre',
    affectedLines: '🚇 Líneas afectadas',
    updated: 'ℹ️ Actualizado'
};

module.exports = {
    parentCommand: 'calendario-metro',
    data: (subcommand) => subcommand
        .setName('mes')
        .setDescription('Muestra el calendario mensual con eventos y horarios extendidos'),

    async execute(interaction) {
        try {
            await interaction.deferReply();
            
            // Set Spanish locale for month names
            moment.locale('es');
            
            const currentDate = TimeHelpers.currentTime;
            const monthStart = currentDate.clone().startOf('month');
            const monthDays = Array.from({ length: monthStart.daysInMonth() }, (_, i) => 
                monthStart.clone().add(i, 'days')
            );

            // Get festive days and events
            const festiveDays = monthDays.filter(day => 
                TimeHelpers.isFestiveDay(day.format('YYYY-MM-DD'))
            );
            
            const monthlyEvents = TimeHelpers.events.filter(event =>
                moment(event.date).isBetween(monthStart, monthStart.clone().endOf('month'), null, '[]')
            );

            // Create embed
            const embed = new EmbedBuilder()
                .setTitle(translations.title)
                .setColor('#005BA6')
                .setDescription(`${translations.month}: ${monthStart.format('MMMM YYYY')}`);

            // Add festive days
            embed.addFields({
                name: translations.festiveDays,
                value: festiveDays.length > 0 
                    ? festiveDays.map(d => `▸ ${d.format('DD [de] MMMM')}`).join('\n')
                    : translations.noFestiveDays,
                inline: true
            });

            // Add events section
            if (monthlyEvents.length > 0) {
                let eventsDescription = '';
                
                monthlyEvents.forEach(event => {
                    const eventDate = moment(event.date);
                    const dayHelper = Object.create(TimeHelpers);
                    Object.assign(dayHelper, TimeHelpers);
                    dayHelper.currentTime = eventDate.clone();
                    
                    const operatingHours = dayHelper.getOperatingHours();
                    
                    console.log(event) 
                    
                    let eventText = `**${eventDate.format('DD [de] MMMM')}**\n`;
                    eventText += `» ${event.name}\n`;
                    eventText += `${translations.closingTime}: ${event.extendedHours.closing}`;
                    
                    if (event.extendedHours) {
                        eventText += ` (Extensión)`;
                    }
                    
                    if (event.outStations && Object.keys(event.outStations).length > 0) {
                        const affectedLines = Object.keys(event.outStations);
                        const emojiLines = affectedLines.map(line => 
                            config.linesEmojis[line.toLowerCase()] || line
                        );
                        eventText += `\n${translations.affectedLines}: ${emojiLines.join(', ')}`;
                    }
                    
                    eventsDescription += eventText + '\n\n';
                });

                embed.addFields({
                    name: translations.eventsTitle,
                    value: eventsDescription,
                    inline: false
                });
            } else {
                embed.addFields({
                    name: translations.eventsTitle,
                    value: translations.noEvents,
                    inline: false
                });
            }

            // Add footer
            embed.setFooter({
                text: `${translations.updated}: ${currentDate.format('DD/MM HH:mm')}`
            });

            await interaction.editReply({ embeds: [embed] });
            
        } catch (error) {
            console.error('Error en /metro mes:', error);
            await interaction.editReply({
                content: '❌ Error al generar el calendario mensual',
                ephemeral: true
            });
        }
    }
};

