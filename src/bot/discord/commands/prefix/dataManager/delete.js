const fs = require('fs').promises;

const path = require('path');

const { createEmbed } = require('../updateembeds.js');

const { baseDir } = {};

const { confirmAction } = require('../../../../../core/metro/core/utils.js');

async function handleDelete(message, methods) {

    const [type, ...args] = methods;

    if (type === 'directory') {

        const directoryPath = args.join('/');

        if (!directoryPath) throw new Error('Nombre de directorio requerido');

        const confirmed = await confirmAction(message, `¿Eliminar el directorio \`${directoryPath}\` y todo su contenido? (y/n)`);

        if (!confirmed) {

            const embed = createEmbed(

                '❌ **Eliminación de directorio cancelada.**',

                'error'

            );

            return message.reply({ embeds: [embed] });

        }

        await fs.rm(path.join(baseDir, directoryPath), { recursive: true, force: true });

        const embed = createEmbed(

            `✅ **Directorio eliminado:** \`${directoryPath}\``,

            'success'

        );

        await message.reply({ embeds: [embed] });

    } else if (type === 'file') {

        const [directoryPath, file] = [args.slice(0, -1).join('/'), args[args.length - 1]];

        if (!directoryPath || !file) throw new Error('Especifica directorio y archivo');

        const confirmed = await confirmAction(message, `¿Eliminar el archivo \`${file}.json\` en \`${directoryPath}\`? (y/n)`);

        if (!confirmed) {

            const embed = createEmbed(

                '❌ **Eliminación de archivo cancelada.**',

                'error'

            );

            return message.reply({ embeds: [embed] });

        }

        await fs.unlink(path.join(baseDir, directoryPath, `${file}.json`));

        const embed = createEmbed(

            `✅ **Archivo eliminado:** \`${file}.json\` en \`${directoryPath}\``,

            'success'

        );

        await message.reply({ embeds: [embed] });

    } else {

        throw new Error('Tipo de eliminación no válida. Usa `directory` o `file`.');

    }

}

module.exports = { handleDelete };