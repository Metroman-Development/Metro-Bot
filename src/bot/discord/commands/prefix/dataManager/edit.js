const fs = require('fs').promises;
const path = require('path');
const { createEmbed } = require('../../utils/embeds');
const { baseDir } = require('../../config/config.json');
const { safeReadFile } = require('../../src/utils/fileUtils');
const { confirmAction } = require('../../utils/utils');

async function handleEdit(message, methods) {
    const [type, ...args] = methods;

    if (type !== 'file') throw new Error('Debes especificar un archivo con `edit.file`');
    if (args.length < 3) throw new Error('Especifica directorio, archivo y clave');

    const [directoryPath, file, keyAction, key, action, ...values] = [
        args.slice(0, -3).join('/'),
        args[args.length - 3],
        args[args.length - 2],
        args[args.length - 1],
        ...values
    ];

    if (!directoryPath || !file) throw new Error('Especifica directorio y archivo');
    if (keyAction !== 'key') throw new Error('Formato inválido. Usa `key.<nombre>`');
    if (!action) throw new Error('Especifica acción: `add` o `remove`');

    const filePath = path.join(baseDir, directoryPath, `${file}.json`);
    const data = await safeReadFile(filePath);

    // Create key if it doesn't exist
    if (!data[key]) {
        const confirmed = await confirmAction(message, `¿Crear la clave \`${key}\`? (y/n)`);
        if (!confirmed) {
            const embed = createEmbed(
                '❌ **Creación de clave cancelada.**',
                'error'
            );
            return message.reply({ embeds: [embed] });
        }

        data[key] = [];
        await fs.writeFile(filePath, JSON.stringify(data, null, 2));
        const embed = createEmbed(
            `🔑 **Clave creada:** \`${key}\` (ahora es un array vacío).`,
            'warning'
        );
        await message.reply({ embeds: [embed] });
    }

    const processedValues = values.join('.').split(',').map(v => v.replace(/_/g, ' '));

    if (action === 'add') {
        data[key].push(...processedValues);
        await fs.writeFile(filePath, JSON.stringify(data, null, 2));
        const embed = createEmbed(
            `✅ **Añadido a \`${key}\`:** \`${processedValues.join(', ')}\``,
            'success'
        );
        await message.reply({ embeds: [embed] });
    } else if (action === 'remove') {
        data[key] = data[key].filter(item => !processedValues.includes(item));
        await fs.writeFile(filePath, JSON.stringify(data, null, 2));
        const embed = createEmbed(
            `✅ **Eliminado de \`${key}\`:** \`${processedValues.join(', ')}\``,
            'success'
        );
        await message.reply({ embeds: [embed] });
    }
}

module.exports = { handleEdit };