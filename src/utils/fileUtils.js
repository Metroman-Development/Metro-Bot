const fs = require('fs').promises;
const path = require('path');
const { baseDir } = { baseDir: '' };

async function safeReadFile(filePath) {
    try {
        return JSON.parse(await fs.readFile(filePath, 'utf8'));
    } catch (error) {
        if (error.code === 'ENOENT') throw new Error('El archivo no existe.');
        throw new Error('Error al leer el archivo.');
    }
}

module.exports = { safeReadFile };