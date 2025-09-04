/**
 * @file stationMainEmbed.js
 * @description Creates the main embed for a station.
 */

const { EmbedBuilder } = require('discord.js');
const { normalizeStationData, getPrimaryImage, processCommerceText, processAccessibilityText } = require('../utils/stationUtils');
const { getLineColor, getLineImage } = require('../utils/metroUtils');
const metroConfig = require('../config/metro/metroConfig');

/**
 * Creates the main embed for a station.
 * @param {object} station The station data.
 * @param {object} metroData The metro data.
 * @returns {EmbedBuilder} The created embed.
 */
function create({ station, metroData }) {
    if (!station) throw new Error('Station data is required');

    const normalizedStation = normalizeStationData(station);
    const stationDyna = metroData?.stations?.[normalizedStation.code?.toUpperCase()];
    const lineColor = getLineColor(normalizedStation.line);

    let stationDeco = `${metroConfig.linesEmojis[normalizedStation.line.toLowerCase()] || '🚇'}`;
    if (stationDyna?.status_data?.js_code) {
        stationDeco += metroConfig.statusTypes[parseInt(stationDyna.status_data.js_code)]?.emoji || 'ℹ️';
    }
    if (normalizedStation.ruta) {
        const rutaKey = normalizedStation.ruta.toLowerCase().replace(/ /g, "").replace("ruta", "").replace("ú", "u");
        stationDeco += metroConfig.routeStyles[rutaKey]?.emoji || '';
    }

    const embed = new EmbedBuilder()
        .setTitle(`${stationDeco} ${normalizedStation.displayName}`)
        .setColor(lineColor)
        .setImage(getPrimaryImage(normalizedStation))
        .addFields(
            {
                name: '📢 Estado',
                value: stationDyna?.status_data?.status_message || 'Sin información',
                inline: true
            }
        );

    if (normalizedStation.services) {
        let servicesText = normalizedStation.services
            .replace(/redbanc/gi, metroConfig.services?.redbanc || 'Redbanc')
            .replace(/tel[ée]fonos/gi, metroConfig.services?.telefono || 'Teléfonos')
            .replace(/Máquinas de carga autoservicio/gi, metroConfig.services?.selfservice || 'Máquinas de carga');

        embed.addFields({
            name: '📖 Servicios',
            value: servicesText,
            inline: false
        });
    }

    addAccessibilityField(embed, normalizedStation);

    if (normalizedStation.commerce) {
        embed.addFields({
            name: '🛍️ Comercio',
            value: processCommerceText(normalizedStation.commerce),
            inline: false
        });
    }

    if (normalizedStation.amenities) {
        let amenitiesText = `👉 *${normalizedStation.amenities}*`;
        if (normalizedStation.amenities.toLowerCase().includes('bibliometro')) {
            amenitiesText = amenitiesText.replace(
                /bibliometro/gi,
                metroConfig.culture?.bibliometro || 'Bibliometro'
            );
        }

        embed.addFields({
            name: '🎭 Cultura',
            value: amenitiesText,
            inline: false
        });
    }

    if (normalizedStation.connections?.lines?.length > 0) {
        embed.addFields({
            name: '🔄 Conecta con',
            value: normalizedStation.connections.lines
                .map(l => `${metroConfig.linesEmojis[l.toLowerCase()] || `Línea ${l}`}`)
                .join(', '),
            inline: true
        });
    }

    return embed;
}

function addAccessibilityField(embed, station) {
    if (!station.accessibility) return;

    const processedLines = processAccessibilityText(station.accessibility);
    const fullText = processedLines.join('\n');

    embed.addFields({
        name: `${metroConfig.accessibility?.logo || '♿'} Accesibilidad`,
        value: fullText,
        inline: false
    });
}

module.exports = {
    create,
};
