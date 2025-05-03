const fs = require('fs').promises;
const path = require('path');
const { createEmbed } = require('../../utils/embeds');
const { baseDir } = require('../../config/config.json');
const { safeReadFile } = require('../../utils/fileUtils');

async function handleClear(message, methods) {
    const [type, directory, file, key] = methods;

    if (type !== 'key') throw new Error('Debes especificar una clave con `clear.key`');
    if (!directory || !file || !key) throw new Error('Especifica directorio, archivo y clave');

    const filePath = path.join(baseDir, directory, `${file}.json`);
    const data = await safeReadFile(filePath);

    // Check if the key exists and is an array
    if (!data[key]) {
        throw new Error(`La clave \`${key}\` no existe en \`${file}.json\`.`);
    }
    if (!Array.isArray(data[key])) {
        throw new Error(`La clave \`${key}\` no es un array.`);
    }

    // Clear the array
    data[key] = [];
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));

    const embed = createEmbed(
        `✅ **Contenido de la clave \`${key}\` eliminado:** \`${file}.json\` en \`${directory}\``,
        'success'
    );
    await message.reply({ embeds: [embed] });
}

module.exports = { handleClear };