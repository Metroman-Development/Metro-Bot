const { createEmbed } = require('../updateembeds.js');
const { handleCreate } = require('./create.js');
const { handleDelete } = require('./delete.js');

module.exports = {
    name: 'undo',
    async run(message, userData) {
        if (!userData.lastCommand) {
            throw new Error('No hay comandos recientes para deshacer.');
        }

        const { action, methods } = userData.lastCommand;

        userData.redoCommand = { action, methods };

        switch (action) {
            case 'create':
                await handleDelete(message, methods);
                break;
            case 'edit':
                throw new Error('Deshacer ediciones no está implementado aún.');
            case 'delete':
                await handleCreate(message, methods);
                break;
            case 'clear':
                throw new Error('Deshacer limpieza no está implementado aún.');
            default:
                throw new Error('No se puede deshacer este comando.');
        }

        const embed = createEmbed(
            `✅ **Comando deshecho:** \`${action}.${methods.join('.')}\``,
            'success'
        );
        await message.reply({ embeds: [embed] });
    }
};