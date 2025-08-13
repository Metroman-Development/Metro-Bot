const { Client, MessageEmbed } = require('discord.js');
const config = {};
const metroConfig = require('../../../../config/metro/metroConfig'); // Import metroConfig
const styles = require('../../../../config/styles.json');

module.exports = {
    name: 'test',
    description: 'Ejecuta código JavaScript y muestra los resultados.',
    usage: 'm!test <código>',
    async execute(message, args) {
        // Check if the user is the owner
        if (message.author.id !== config.ownerID) {
            return message.reply('❌ Este comando solo puede ser utilizado por el propietario del bot.');
        }

        let code = args.join(' ');

        // Check if the message contains a code block
        if (code.startsWith('```') && code.endsWith('```')) {
            code = code.slice(3, -3).trim(); // Remove the triple backticks
        }

        if (!code) {
            return message.reply('❌ Uso correcto: `m!test <código>` o usa un bloque de código con ```.');
        }

        // Check for dangerous code
        if (this.isDangerousCode(code)) {
            return message.reply('❌ Código peligroso detectado. Ejecución cancelada.');
        }

        try {
            // Replace all config references in the code
            const processedCode = this.replaceConfigReferences(code);

            // Evaluate the code
            const result = eval(processedCode);

            // Send the result
            await message.reply(`✅ Resultado:\n\`\`\`js\n${this.formatResult(result)}\n\`\`\``);
        } catch (error) {
            console.error('Error al ejecutar el código:', error);
            await message.reply(`❌ Error al ejecutar el código:\n\`\`\`\n${error.message}\n\`\`\``);
        }
    },

    /**
     * Replace all config references in a string.
     */
    replaceConfigReferences(input) {
        return input
            .replace(/@metroConfig\.("([^"]+)"|'([^']+)'|([\w.]+))/g, (match, _, quoted1, quoted2, unquoted) => {
                const key = quoted1 || quoted2 || unquoted;
                const value = this.getConfigValue(metroConfig, key);
                return value !== null ? JSON.stringify(value) : 'null';
            })
            .replace(/@styles\.("([^"]+)"|'([^']+)'|([\w.]+))/g, (match, _, quoted1, quoted2, unquoted) => {
                const key = quoted1 || quoted2 || unquoted;
                const value = this.getConfigValue(styles, key);
                return value !== null ? JSON.stringify(value) : 'null';
            });
    },

    /**
     * Retrieve a value from a configuration object using a dot notation key.
     */
    getConfigValue(config, key) {
        const keys = key.split('.'); // Split the key by dots (e.g., "colors.primary")
        let value = config;

        for (const k of keys) {
            if (value && typeof value === 'object' && k in value) {
                value = value[k]; // Traverse the object
            } else {
                return null; // Key not found
            }
        }

        return value; // Return the value (can be any type)
    },

    /**
     * Format the result for display.
     */
    formatResult(result) {
        if (typeof result === 'object' && result !== null) {
            return JSON.stringify(result, null, 2); // Pretty-print objects
        }
        return String(result); // Convert other types to string
    },

    /**
     * Check if the code contains dangerous patterns.
     */
    isDangerousCode(code) {
        const dangerousPatterns = [
            /process\.exit\(/i, // Block process.exit()
            /require\(/i, // Block require()
            /eval\(/i, // Block eval()
            /Function\(/i, // Block Function constructor
            /while\s*\(true\)/, // Block infinite loops
            /for\s*\(;;\)/, // Block infinite loops
            /fs\./i, // Block file system access
            /child_process\./i, // Block child process creation
            /exec\(/i, // Block shell execution
            /spawn\(/i, // Block process spawning
        ];

        // Check if any dangerous pattern is found
        return dangerousPatterns.some(pattern => pattern.test(code));
    },

    /**
     * Get a random example of how to use mentions.
     */
    getRandomExample(configType) {
        const examples = {
            metroConfig: [
                'Ejemplo: `@metroConfig.hi` → "Hello"',
                'Ejemplo: `@metroConfig.issues.delay` → "10 minutes"',
                'Ejemplo: `@metroConfig."key with spaces"` → "Value"',
            ],
            styles: [
                'Ejemplo: `@styles.colors.primary` → "#3498db"',
                'Ejemplo: `@styles.fonts.header` → "Arial, sans-serif"',
                'Ejemplo: `@styles."key with spaces"` → "Value"',
            ],
        };

        const randomIndex = Math.floor(Math.random() * examples[configType].length);
        return examples[configType][randomIndex];
    },
};