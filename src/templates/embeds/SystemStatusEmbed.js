const BaseEmbed = require('./baseEmbed');
const config = require('../../config/metro/metroConfig');

class SystemStatusEmbed extends BaseEmbed {
    constructor(metroCore) {
        super(metroCore);
    }

    createSystemStatusEmbed(report) {
        const { system, health, changes, metrics } = report;
        const { network, lines, stations, lastUpdated, version } = system;

        const operationalLines = lines.operational;
        const totalLines = lines.total;
        const operationalStations = stations.operational;
        const totalStations = stations.total;

        const embed = {
            title: '📊 Reporte de Estado del Sistema',
            color: health.operational ? 0x00AA00 : 0xAA0000,
            fields: [
                {
                    name: 'Estado General',
                    value: `**Red:** ${network.status === 'operational' ? '🟢 Operacional' : '🔴 No operacional'}\n**Versión de Datos:** ${version}`,
                    inline: false
                },
                {
                    name: 'Líneas',
                    value: `Operacionales: **${operationalLines} / ${totalLines}**`,
                    inline: true
                },
                {
                    name: 'Estaciones',
                    value: `Operacionales: **${operationalStations} / ${totalStations}**`,
                    inline: true
                },
                {
                    name: 'Salud del Sistema',
                    value: `**API:** ${health.subsystems.api.status}\n**Eventos:** ${health.subsystems.event.listenerCount} listeners`,
                    inline: false
                },
                {
                    name: 'Métricas',
                    value: `**Uso de Memoria:** ${(metrics.memory.rss / 1024 / 1024).toFixed(2)} MB`,
                    inline: true
                },
                {
                    name: 'Cambios Recientes',
                    value: `**Total:** ${changes.total}`,
                    inline: true
                }
            ],
            footer: {
                text: `Última actualización: ${new Date(lastUpdated).toLocaleString('es-CL')}`
            }
        };

        return { embed };
    }
}

module.exports = SystemStatusEmbed;
