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
            value: processCommerceText(normalizedStation.commerce, metroConfig),
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

    if (normalizedStation.connections) {
        const lines = normalizedStation.connections.lines?.length || 0;
        const others = normalizedStation.connections.other?.length || 0;
        const bikes = normalizedStation.connections.bikes?.length || 0;

        if (lines > 0 || others > 0 || bikes > 0) {
            const summary = [];
            if (lines > 0) summary.push(`${lines} línea(s)`);
            if (others > 0) summary.push(`${others} otro(s)`);
            if (bikes > 0) summary.push(`${bikes} bici(s)`);

            embed.addFields({
                name: '🔄 Conexiones',
                value: `Esta estación conecta con ${summary.join(', ')}.`,
                inline: false
            });
        }
    }

    return embed;
}

function addAccessibilityField(embed, station) {
    if (!station.accessibility) return;

    const accessibility = station.accessibility;
    const nonOperationalElevators = accessibility.filter(item => item.tipo === 'ascensor' && item.estado !== 1).length;
    const nonOperationalEscalators = accessibility.filter(item => item.tipo === 'escalera' && item.estado !== 1).length;
    const nonOperationalOther = accessibility.filter(item => item.tipo !== 'ascensor' && item.tipo !== 'escalera' && item.estado !== 1).length;

    let summary;
    if (nonOperationalElevators === 0 && nonOperationalEscalators === 0 && nonOperationalOther === 0) {
        summary = '✅ Todos los equipos de accesibilidad se encuentran operativos.';
    } else {
        const issues = [];
        if (nonOperationalElevators > 0) {
            issues.push(`${nonOperationalElevators} ascensor(es)`);
        }
        if (nonOperationalEscalators > 0) {
            issues.push(`${nonOperationalEscalators} escalera(s)`);
        }
        if (nonOperationalOther > 0) {
            issues.push(`${nonOperationalOther} otro(s)`);
        }
        summary = `⚠️ Se reportan incidencias en ${issues.join(', ')}.`;
    }

    embed.addFields({
        name: `♿ Accesibilidad`,
        value: summary,
        inline: false
    });
}

module.exports = {
    create,
};
