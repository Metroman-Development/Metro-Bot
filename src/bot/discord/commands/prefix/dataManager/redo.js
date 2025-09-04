const { createEmbed } = require('../updateembeds.js');
const { handleCreate } = require('./create.js');
const { handleEdit } = require('./edit.js');
const { handleDelete } = require('./delete.js');
const { handleClear } = require('./clear.js');

module.exports = {
    name: 'redo',
    async run(message, userData) {
        if (!userData.redoCommand) {
            throw new Error('No hay comandos recientes para rehacer.');
        }

        const { action, methods } = userData.redoCommand;

        switch (action) {
            case 'create':
                await handleCreate(message, methods);
                break;
            case 'edit':
                await handleEdit(message, methods);
                break;
            case 'delete':
                await handleDelete(message, methods);
                break;
            case 'clear':
                await handleClear(message, methods);
                break;
            default:
                throw new Error('No se puede rehacer este comando.');
        }

        const embed = createEmbed(
            `✅ **Comando rehecho:** \`${action}.${methods.join('.')}\``,
            'success'
        );
        await message.reply({ embeds: [embed] });
    }
};