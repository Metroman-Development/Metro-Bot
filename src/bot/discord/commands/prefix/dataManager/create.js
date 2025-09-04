const fs = require('fs').promises;
const path = require('path');
const { createEmbed } = require('../updateembeds.js');
const { baseDir } = require('../../../../../config/index.js');
const metroDataFramework = {};

module.exports = {
    name: 'create',
    async run(message, methods) {
        const [type, ...args] = methods;

        if (!type) throw new Error('Especifica qué crear: `directory` o `file`');

        if (type === 'directory') {
            const directoryPath = args.join('/');
            if (!directoryPath) throw new Error('Nombre de directorio requerido');
            await fs.mkdir(path.join(baseDir, directoryPath), { recursive: true });
            const embed = createEmbed(
                `✅ **Directorio creado:** \`${directoryPath}\``,
                'success'
            );
            await message.reply({ embeds: [embed] });
        } else if (type === 'file') {
            const [directoryPath, file] = [args.slice(0, -1).join('/'), args[args.length - 1]];
            if (!directoryPath || !file) throw new Error('Debes especificar directorio y nombre de archivo');
            const filePath = path.join(baseDir, directoryPath, `${file}.json`);
            await fs.mkdir(path.join(baseDir, directoryPath), { recursive: true });
            await fs.writeFile(filePath, JSON.stringify(metroDataFramework, null, 2));
            const embed = createEmbed(
                `✅ **Archivo creado:** \`${file}.json\` en \`${directoryPath}\``,
                'success'
            );
            await message.reply({ embeds: [embed] });
        } else {
            throw new Error('Tipo de creación no válido. Usa `directory` o `file`.');
        }
    }
};