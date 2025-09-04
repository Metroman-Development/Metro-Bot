const fs = require('fs').promises;
const path = require('path');
const { createEmbed } = require('../updateembeds.js');
const { baseDir } = require('../../../../../config/index.js');

module.exports = {
    name: 'list',
    async run(message, methods) {
        const [type, ...args] = methods;

        if (type === 'directories') {
            const directoryPath = args.join('/');
            const dirPath = path.join(baseDir, directoryPath);
            const directories = await fs.readdir(dirPath, { withFileTypes: true });
            const dirNames = directories.filter(d => d.isDirectory()).map(d => d.name);

            if (dirNames.length === 0) {
                const embed = createEmbed(
                    'No hay directorios disponibles.',
                    'warning',
                    "📂 **Directorios**"
                );
                await message.reply({ embeds: [embed] });
            } else {
                const embed = createEmbed(
                    dirNames.map(d => `- \`${d}\``).join('\n'),
                    'info',
                    "📂 **Directorios**"
                );
                await message.reply({ embeds: [embed] });
            }
        } else if (type === 'files') {
            const directoryPath = args.join('/');
            if (!directoryPath) throw new Error('Especifica un directorio');

            const dirPath = path.join(baseDir, directoryPath);
            const files = await fs.readdir(dirPath, { withFileTypes: true });
            const fileNames = files.filter(f => f.isFile()).map(f => f.name);

            if (fileNames.length === 0) {
                const embed = createEmbed(
                    'No hay archivos en este directorio.',
                    'warning',
                    `📄 **Archivos en \`${directoryPath}\``
                );
                await message.reply({ embeds: [embed] });
            } else {
                const embed = createEmbed(
                    fileNames.map(f => `- \`${f}\``).join('\n'),
                    'info',
                    `📄 **Archivos en \`${directoryPath}\``
                );
                await message.reply({ embeds: [embed] });
            }
        } else {
            throw new Error('Tipo de listado no válido. Usa `directories` o `files`.');
        }
    }
};