/*const { EmbedBuilder} = require('discord.js');
const { getCachedMetroData } = require('./metroDataHandler');
const metroConfig = require('../config/metroConfig');
const logger = require('./logger');
const metroUpdatesEmbed = require('../config/defaultEmbeds/metroUpdatesEmbed');
const { getStatusSummary, getNetworkStatus } = require('../statusHelpers/changeDetector');

const TARGET_CHANNEL_ID = metroConfig.updatesChannelId;

function createStatusMessage(options = {}, testData = null) {
    const {
        includeDetails = true,
        includeLogo = true,
        includeHeader = true
    } = options;

    const summary = testData ? testData.summary : getStatusSummary();
    const networkStatus = testData ? testData.networkStatus : getNetworkStatus();
    const logo = includeLogo ? metroConfig.logoMetroEmoji : '';

    if (networkStatus === 0) {
        return `${logo} **Cierre por Horario**\nEl metro se encuentra cerrado según su horario habitual.`;
    }

    if (networkStatus === 5) {
        return `${logo} **Servicio Extendido**\nEl metro está operando con horario extendido.`;
    }

    if (networkStatus === 1) {
        return `${logo} **Toda la Red Operativa**\nTodas las líneas y estaciones funcionan normalmente.`;
    }

    let message = includeHeader ? '🚨 **Estado del Metro** 🚨\n\n' : '';
    const statusMessages = {
        2: 'Algunas estaciones cerradas',
        3: 'Servicio parcial en algunas líneas',
        4: 'Retrasos en algunas líneas'
    };
    
    if (statusMessages[networkStatus]) {
        message += `🔹 **Estado Actual:** ${statusMessages[networkStatus]}\n\n`;
    }

    if (includeDetails && summary.messages) {
        Object.entries(summary.messages).forEach(([msg, data]) => {
            if (msg && msg !== 'undefined') {
                message += `🔹 **${msg}**\n`;

                if (data.lines && data.lines.length > 0) {
                    const lineList = data.lines.map(l => `L${l.line} (${metroConfig.statusMapping[l.estado]?.emoji || '🔵'})`);
                    message += `📌 Líneas afectadas: ${lineList.join(', ')}\n`;
                }

                if (data.stations) {
                    Object.entries(data.stations).forEach(([line, stations]) => {
                        if (stations && stations.length > 0) {
                            const stationList = stations.map(s => `${s.station} (${metroConfig.statusMapping[s.estado]?.emoji || '🔵'})`);
                            message += `🚉 Estaciones en L${line}: ${stationList.join(', ')}\n`;
                        }
                    });
                }
                message += '\n';
            }
        });
    }

    return message;
}

async function sendMetroUpdate(client, options = {}) {
    try {
        const {
            period = 'UPDATE',
            type = 'change',
            eventData = null,
            messageOptions = {},
            forceSend = false,
            testData = null
        } = options;

        const metroData = testData ? testData.metroData : await getCachedMetroData();
        const statusMessage = createStatusMessage(messageOptions, testData);

        if (!forceSend && type === 'change' && (!testData && getNetworkStatus() === 1) && !getStatusSummary().hasEstado0) {
            logger.info('No significant changes detected, skipping update');
            return;
        }

        let embed;
        switch (period) {
            case 'SERVICE':
                embed = metroUpdatesEmbed.serviceAnnouncement(
                    type,
                    statusMessage,
                    getScheduleForPeriod(period, type),
                    metroData
                );
                break;
            case 'EXPRESS_MORNING':
            case 'EXPRESS_EVENING':
                embed = metroUpdatesEmbed.expressAnnouncement(
                    period,
                    type,
                    statusMessage,
                    metroData
                );
                break;
            case 'PUNTA':
            case 'BAJO':
            case 'VALLE':
                embed = metroUpdatesEmbed.farePeriodAnnouncement(
                    period,
                    type,
                    statusMessage,
                    getScheduleForPeriod(period, type)
                );
                break;
            case 'EVENT':
                embed = metroUpdatesEmbed.eventAnnouncement(
                    eventData,
                    statusMessage
                );
                break;
            default:
                embed = metroUpdatesEmbed.statusUpdateEmbed(
                    statusMessage,
                    metroData,
                    period === 'INIT' ? 'Inicialización del Sistema' : 'Actualización de Estado'
                );
        }

        const targetChannel = await client.channels.fetch(TARGET_CHANNEL_ID);
        if (!targetChannel) {
            logger.error('Target channel not found.');
            return;
        }

        await targetChannel.send({ embeds: [embed] });
        logger.info(`Sent ${period} announcement: ${type}`);
    } catch (error) {
        logger.error(`Error sending ${period} announcement: ${error.message}`);
    }
}

function getScheduleForPeriod(period, type) {
    const schedules = metroConfig.horarioPeriodos;
    const periodMap = {
        SERVICE: schedules.SERVICEHOURS,
        EXPRESS_MORNING: schedules.horarioExpreso.morning,
        EXPRESS_EVENING: schedules.horarioExpreso.evening,
        PUNTA: schedules.PUNTA,
        BAJO: schedules.BAJO,
        VALLE: schedules.VALLE
    };

    const schedule = periodMap[period] || schedules.SERVICEHOURS;
    return type === 'start' ? schedule[0] : schedule[1];
}

module.exports = {
    sendMetroUpdate,
    createStatusMessage
};
*/