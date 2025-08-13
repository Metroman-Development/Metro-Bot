const { createEmbed } = require('../../utils/embeds');

async function handleUndo(message, userData) {
    if (!userData.lastCommand) {
        throw new Error('No hay comandos recientes para deshacer.');
    }

    const { action, methods } = userData.lastCommand;

    // Store the current command for redo
    userData.redoCommand = { action, methods };

    // Reverse the last command
    switch (action) {
        case 'create':
            await handleDelete(message, methods); // Undo create by deleting
            break;
        case 'edit':
            // TODO: Implement undo for edit (requires storing previous state)
            throw new Error('Deshacer ediciones no está implementado aún.');
        case 'delete':
            await handleCreate(message, methods); // Undo delete by recreating
            break;
        case 'clear':
            // TODO: Implement undo for clear (requires storing previous state)
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

module.exports = { handleUndo };