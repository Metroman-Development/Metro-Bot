// Versión nueva (/buttons/transport/expressRoutes.js)
const { PaginationTemplate } = require('../templates/pagination.js');

module.exports = PaginationTemplate.create({
    idPrefix: 'express',
    async fetchData(page) {
        const [routes, total] = await Promise.all([
            RouteAPI.getPaginated(page),
            RouteAPI.getCount()
        ]);
        return { items: routes, totalPages: Math.ceil(total / 10) };
    },
    buildEmbed(data) {
        return new EmbedBuilder()
            .setTitle(`Rutas Express - Pág. ${data.currentPage + 1}`)
            .setDescription(data.items.map(r => `• ${r.name}`).join('\n'));
    }
});