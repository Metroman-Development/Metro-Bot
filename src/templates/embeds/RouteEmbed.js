// templates/embeds/RouteEmbed.js
const BaseEmbed = require('./baseEmbed');
const { decorateStation } = require('../../utils/stringUtils');

class RouteEmbed extends BaseEmbed {
    async create(lineKey, routeType, stations, page = 0, interaction = null) {
        const { items: paginatedStations, totalPages } = this.paginateContent(stations, page, 10);
        const stationDisplays = await Promise.all(
            paginatedStations.map(station => 
                decorateStation(station, { line: lineKey, ruta: routeType })
        )) ;

        const routeDisplay = routeType === 'todas' 
            ? 'Todas las rutas' 
            : routeType.split('+').map(r => r.charAt(0).toUpperCase() + r.slice(1)).join(' + ');

        return this.createEmbed({
            title: `${metroConfig.linesEmojis[lineKey]} ${routeDisplay} - Línea ${lineKey.toUpperCase()}`,
            description: `**Mostrando ${paginatedStations.length} de ${stations.length} estaciones**`,
            fields: [{
                name: '🚉 Estaciones',
                value: stationDisplays.join('\n') || 'No hay estaciones disponibles'
            }],
            footer: {
                text: interaction 
                    ? `Página ${page + 1}/${totalPages} • ${interaction.user.username}` 
                    : `Página ${page + 1}/${totalPages}`,
                iconURL: interaction?.user.displayAvatarURL()
            },
            color: styles.routeColors[routeType.split('+')[0]],
            thumbnail: metroConfig.metroLogo.principal
        });
    }
}

module.exports = RouteEmbed;