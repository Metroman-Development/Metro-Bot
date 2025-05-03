// Versión nueva (/buttons/transport/disambiguation.js)
const { SelectionTemplate } = require('../../templates/selection');

module.exports = SelectionTemplate.create({
    idPrefix: 'station_amb',
    style: 'buttons', // Opción: 'menu' para selectMenus
    async fetchOptions() {
        return (await StationManager.getAmbiguous()).map(s => ({
            label: `${s.name} (Línea ${s.line})`,
            value: s.id,
            emoji: '🚇'
        }));
    },
    onSelect(interaction, stationId) {
        const station = StationManager.resolve(stationId);
        interaction.update(StationEmbed.build(station));
    }
});