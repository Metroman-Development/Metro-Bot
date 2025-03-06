const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');

module.exports = {
    name: 'botAdmin', // Nombre del comando principal
    description: 'Comandos de administración para gestionar el bot',
    usage: '!botAdmin <subcomando> [argumentos]',
    async execute(message, args, client) {
        // Restringir el comando a un ID de usuario específico
        const allowedUserId = '1261050272906481808'; // Reemplaza con el ID del usuario permitido
        if (message.author.id !== allowedUserId) {
            return message.reply('No tienes permiso para usar este comando.');
        }

        // Verificar si se proporciona un subcomando
        if (args.length === 0) {
            return message.reply('Uso: !botAdmin <subcomando> [argumentos]');
        }

        const subcommand = args[0].toLowerCase();

        // Manejar subcomandos
        switch (subcommand) {
            case 'addprefixcommand': {
                // Validar argumentos
                if (args.length < 3) {
                    return message.reply('Uso: !botAdmin addprefixcommand <nombreDelComando> <código>');
                }

                const commandName = args[1].toLowerCase();
                const code = args.slice(2).join(' ');

                // Validar el nombre del comando
                if (!/^[a-z0-9]+$/i.test(commandName)) {
                    return message.reply('El nombre del comando solo puede contener letras y números.');
                }

                // Validar el código (verificación básica)
                if (!code.includes('execute')) {
                    return message.reply('El código debe incluir una función `execute`.');
                }

                // Crear o actualizar el archivo del comando de prefijo
                const prefixFilePath = path.join(__dirname, '..', 'commands', 'prefixCommands', `${commandName}.js`);
                const prefixFileContent = `module.exports = {
    name: '${commandName}',
    execute(message, args) {
        ${code}
    }
};`;

                try {
                    fs.writeFileSync(prefixFilePath, prefixFileContent);
                    message.reply(`El comando de prefijo '${commandName}' ha sido añadido/actualizado.`);
                } catch (error) {
                    console.error('Error al escribir el archivo del comando de prefijo:', error);
                    message.reply('Hubo un error al añadir/actualizar el comando de prefijo.');
                }
                break;
            }

            case 'addslashcommand': {
                // Validar argumentos
                if (args.length < 3) {
                    return message.reply('Uso: !botAdmin addslashcommand <nombreDelComando> <código>');
                }

                const commandName = args[1].toLowerCase();
                const code = args.slice(2).join(' ');

                // Validar el nombre del comando
                if (!/^[a-z0-9]+$/i.test(commandName)) {
                    return message.reply('El nombre del comando solo puede contener letras y números.');
                }

                // Validar el código (verificación básica)
                if (!code.includes('execute')) {
                    return message.reply('El código debe incluir una función `execute`.');
                }

                // Crear o actualizar el archivo del comando de barra
                const slashFilePath = path.join(__dirname, '..', 'commands', 'slashCommands', `${commandName}.js`);
                const slashFileContent = `const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('${commandName}')
        .setDescription('Descripción de ${commandName}'),
    async execute(interaction) {
        ${code}
    }
};`;

                try {
                    fs.writeFileSync(slashFilePath, slashFileContent);
                    message.reply(`El comando de barra '${commandName}' ha sido añadido/actualizado.`);
                } catch (error) {
                    console.error('Error al escribir el archivo del comando de barra:', error);
                    message.reply('Hubo un error al añadir/actualizar el comando de barra.');
                }
                break;
            }

            case 'edit': {
                // Validar argumentos
                if (args.length < 4) {
                    return message.reply('Uso: !botAdmin edit <prefix|slash> <nombreDelComando> <nuevoCódigo>');
                }

                const commandType = args[1].toLowerCase();
                const commandName = args[2].toLowerCase();
                const newCode = args.slice(3).join(' ');

                // Validar el tipo de comando
                if (commandType !== 'prefix' && commandType !== 'slash') {
                    return message.reply('El tipo de comando debe ser "prefix" o "slash".');
                }

                // Validar el nombre del comando
                if (!/^[a-z0-9]+$/i.test(commandName)) {
                    return message.reply('El nombre del comando solo puede contener letras y números.');
                }

                // Validar el nuevo código (verificación básica)
                if (!newCode.includes('execute')) {
                    return message.reply('El nuevo código debe incluir una función `execute`.');
                }

                // Verificar si el comando existe
                const filePath = path.join(__dirname, '..', 'commands', `${commandType}Commands`, `${commandName}.js`);
                if (!fs.existsSync(filePath)) {
                    return message.reply(`El comando '${commandName}' no existe.`);
                }

                // Actualizar el archivo del comando
                const fileContent = commandType === 'prefix'
                    ? `module.exports = {
    name: '${commandName}',
    execute(message, args) {
        ${newCode}
    }
};`
                    : `const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('${commandName}')
        .setDescription('Descripción de ${commandName}'),
    async execute(interaction) {
        ${newCode}
    }
};`;

                try {
                    fs.writeFileSync(filePath, fileContent);
                    message.reply(`El comando '${commandName}' ha sido actualizado.`);
                } catch (error) {
                    console.error('Error al actualizar el archivo del comando:', error);
                    message.reply('Hubo un error al actualizar el comando.');
                }
                break;
            }

            case 'remove': {
                // Validar argumentos
                if (args.length < 3) {
                    return message.reply('Uso: !botAdmin remove <prefix|slash> <nombreDelComando>');
                }

                const commandType = args[1].toLowerCase();
                const commandName = args[2].toLowerCase();

                // Validar el tipo de comando
                if (commandType !== 'prefix' && commandType !== 'slash') {
                    return message.reply('El tipo de comando debe ser "prefix" o "slash".');
                }

                // Validar el nombre del comando
                if (!/^[a-z0-9]+$/i.test(commandName)) {
                    return message.reply('El nombre del comando solo puede contener letras y números.');
                }

                // Verificar si el comando existe
                const filePath = path.join(__dirname, '..', 'commands', `${commandType}Commands`, `${commandName}.js`);
                if (!fs.existsSync(filePath)) {
                    return message.reply(`El comando '${commandName}' no existe.`);
                }

                // Eliminar el archivo del comando
                try {
                    fs.unlinkSync(filePath);
                    message.reply(`El comando '${commandName}' ha sido eliminado.`);
                } catch (error) {
                    console.error('Error al eliminar el archivo del comando:', error);
                    message.reply('Hubo un error al eliminar el comando.');
                }
                break;
            }

            case 'reloadcommands': {
                // Limpiar comandos existentes
                client.prefixCommands.clear();
                client.commands.clear();

                // Recargar comandos de prefijo
                const prefixCommandFiles = fs.readdirSync('./prefixCommands').filter(file => file.endsWith('.js'));
                for (const file of prefixCommandFiles) {
                    delete require.cache[require.resolve(`./prefixCommands/${file}`)]; // Limpiar caché
                    const command = require(`./prefixCommands/${file}`);
                    client.prefixCommands.set(command.name, command);
                }

                // Recargar comandos de barra
                const slashCommandFiles = fs.readdirSync('./slashCommands').filter(file => file.endsWith('.js'));
                for (const file of slashCommandFiles) {
                    delete require.cache[require.resolve(`./slashCommands/${file}`)]; // Limpiar caché
                    const command = require(`./slashCommands/${file}`);
                    client.commands.set(command.data.name, command);
                }

                // Registrar comandos de barra globalmente
                const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
                const slashCommands = Array.from(client.commands.values()).map(cmd => cmd.data.toJSON());

                try {
                    await rest.put(
                        Routes.applicationCommands(process.env.CLIENT_ID),
                        { body: slashCommands }
                    );
                    message.reply('Los comandos han sido recargados y los comandos de barra han sido registrados globalmente.');
                } catch (error) {
                    console.error('Error al registrar comandos de barra:', error);
                    message.reply('Hubo un error al recargar los comandos.');
                }
                break;
            }

            default: {
                message.reply(`Subcomando desconocido: ${subcommand}`);
                break;
            }
        }
    }
};