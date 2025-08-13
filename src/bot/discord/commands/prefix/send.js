const { Client, MessageEmbed } = require('discord.js');
const config = {};
const metroConfig = require('../../../../config/metro/metroConfig'); // Import metroConfig
const styles = require('../../../../config/styles.json');

// Store partial messages for reconstruction
const messageBuffer = new Map(); // Key: userId, Value: { content: string, timestamp: number }

module.exports = {
    name: 'send',
    description: 'Envía un mensaje, un embed o un embed reconstruido desde múltiples mensajes.',
    usage: 'm!send <message|embed|buildembed> <channelId|channelMention> <content>',
    subcommands: {
        message: {
            description: 'Envía un mensaje de texto a un canal específico.',
            usage: 'm!send message <channelId|channelMention> <content>',
        },
        embed: {
            description: 'Envía un embed a un canal específico usando JSON raw o código JS.',
            usage: 'm!send embed <channelId|channelMention> <raw JSON|JS code>',
        },
        buildembed: {
            description: 'Reconstruye un embed desde múltiples mensajes. Usa `#End` para finalizar.',
            usage: 'm!send buildembed <channelId|channelMention>',
        },
    },
    async execute(message, args) {
        // Check if the user is the owner
        if (message.author.id !== config.ownerID) {
            return message.reply('❌ Este comando solo puede ser utilizado por el propietario del bot.');
        }

        const [subcommand, channelIdentifier, ...contentParts] = args;

        if (!subcommand || !channelIdentifier) {
            return message.reply('❌ Uso correcto: `m!send message <channelId|channelMention> <content>`, `m!send embed <channelId|channelMention> <raw JSON|JS code>`, o `m!send buildembed <channelId|channelMention>`.');
        }

        // Extract channel ID from mention (if provided)
        const channelId = channelIdentifier.replace(/[<#>]/g, ''); // Remove <, #, and > from mention
        const channel = message.guild.channels.cache.get(channelId);

        if (!channel || !channel.isTextBased()) {
            return message.reply('❌ Canal no válido o no es un canal de texto.');
        }

        switch (subcommand) {
            case 'message':
                await this.handleSendMessage(channel, contentParts.join(' '));
                break;

            case 'embed':
                await this.handleSendEmbed(channel, contentParts.join(' '));
                break;

            case 'buildembed':
                await this.handleBuildEmbed(message, channel);
                break;

            default:
                return message.reply('❌ Subcomando no válido. Usa `m!send message`, `m!send embed`, o `m!send buildembed`.');
        }

        await message.reply('✅ Comando ejecutado correctamente.');
    },

    /**
     * Handle sending a plain text message.
     */
    async handleSendMessage(channel, content) {
        // Replace all config references in the content
        const processedContent = this.replaceConfigReferences(content);
        await this.sendLongMessage(channel, processedContent); // Handle long messages
    },

    /**
     * Handle sending an embed using raw JSON or JS code.
     */
    async handleSendEmbed(channel, input) {
        try {
            let embedData;

            // Check if the input is raw JSON
            if (input.trim().startsWith('{') && input.trim().endsWith('}')) {
                // Parse raw JSON
                embedData = JSON.parse(input);
            } else {
                // Treat input as JS code
                const processedCode = this.replaceConfigReferences(input);
                embedData = eval(`(${processedCode})`); // Evaluate the JS code
            }

            // Create the embed
            const embed = new MessageEmbed(embedData);
            await channel.send({ embeds: [embed] });
        } catch (error) {
            console.error('Error al crear el embed:', error);
            await channel.send(`❌ Error al crear el embed:\n\`\`\`\n${error.message}\n\`\`\``);
        }
    },

    /**
     * Handle building an embed from multiple messages.
     */
    async handleBuildEmbed(message, channel) {
        const userId = message.author.id;

        // Initialize the message buffer for the user
        if (!messageBuffer.has(userId)) {
            messageBuffer.set(userId, { content: '', timestamp: Date.now() });
            await message.reply('🛠️ Comienza a enviar los mensajes para construir el embed. Usa `#End` para finalizar.');
            return;
        }

        // Check if the user has sent `#End`
        if (message.content.trim() === '#End') {
            const userBuffer = messageBuffer.get(userId);
            if (!userBuffer.content) {
                messageBuffer.delete(userId);
                return message.reply('❌ No se recibió ningún contenido para construir el embed.');
            }

            try {
                // Parse the combined content as JSON
                const embedData = JSON.parse(userBuffer.content);
                const embed = new MessageEmbed(embedData);
                await channel.send({ embeds: [embed] });

                // Clear the buffer
                messageBuffer.delete(userId);
                await message.reply('✅ Embed construido y enviado correctamente.');
            } catch (error) {
                console.error('Error al construir el embed:', error);
                await message.reply(`❌ Error al construir el embed:\n\`\`\`\n${error.message}\n\`\`\``);
                messageBuffer.delete(userId);
            }
            return;
        }

        // Append the message content to the buffer
        const userBuffer = messageBuffer.get(userId);
        userBuffer.content += message.content + '\n';
        userBuffer.timestamp = Date.now();

        // Notify the user that the message was added
        await message.reply('✅ Mensaje añadido al buffer. Continúa enviando más mensajes o usa `#End` para finalizar.');
    },

    /**
     * Replace all config references in a string.
     */
    replaceConfigReferences(input) {
        return input
            .replace(/@metroConfig\.("([^"]+)"|'([^']+)'|([\w.]+))/g, (match, _, quoted1, quoted2, unquoted) => {
                const key = quoted1 || quoted2 || unquoted;
                const value = this.getConfigValue(metroConfig, key);
                return value !== null ? value : match; // Keep original if not found
            })
            .replace(/@styles\.("([^"]+)"|'([^']+)'|([\w.]+))/g, (match, _, quoted1, quoted2, unquoted) => {
                const key = quoted1 || quoted2 || unquoted;
                const value = this.getConfigValue(styles, key);
                return value !== null ? value : match;
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
     * Send a long message by splitting it into chunks.
     */
    async sendLongMessage(channel, content) {
        const maxLength = 2000; // Discord character limit per message
        for (let i = 0; i < content.length; i += maxLength) {
            const chunk = content.slice(i, i + maxLength);
            await channel.send(chunk);
        }
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