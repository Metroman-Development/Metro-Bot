const fs = require('fs').promises;
const path = require('path');
const { createEmbed } = require('../updateembeds.js');
const { baseDir } = require('../../../../../config/index.js');
const { safeReadFile } = require('../../../../../utils/fileUtils.js');

module.exports = {
    name: 'replace',
    async run(message, methods) {
        const [type, directory, file, keyAction, key, ...values] = methods;

        if (type !== 'file') throw new Error('Debes especificar un archivo con `replace.file`');
        if (!directory || !file) throw new Error('Especifica directorio y archivo');
        if (keyAction !== 'key') throw new Error('Formato inválido. Usa `key.<nombre>`');

        const filePath = path.join(baseDir, directory, `${file}.json`);
        const data = await safeReadFile(filePath);

        if (!data[key]) {
            throw new Error(`La clave \`${key}\` no existe en \`${file}.json\`.`);
        }

        const processedValues = values.join('.').split(',').map(v => v.replace(/_/g, ' '));
        data[key] = processedValues;

        await fs.writeFile(filePath, JSON.stringify(data, null, 2));

        const embed = createEmbed(
            `✅ **Valor de la clave \`${key}\` reemplazado:** \`${processedValues.join(', ')}\``,
            'success'
        );
        await message.reply({ embeds: [embed] });
    }
};