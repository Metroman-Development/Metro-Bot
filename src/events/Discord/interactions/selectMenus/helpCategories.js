// Versión nueva (/selectMenus/helpCategories.js)
const { FlexibleSelector } = require('../templates/buttons/selection.js');

module.exports = FlexibleSelector.create({
    idPrefix: 'help_cat',
    style: 'menu',
    async fetchOptions() {
        return Object.entries(HelpCategories).map(([id, cat]) => ({
            label: cat.name,
            value: id,
            description: `${cat.commands.length} comandos`
        }));
    },
    onSelect(interaction, categoryId) {
        interaction.update(HelpEmbed.build(categoryId));
    }
});