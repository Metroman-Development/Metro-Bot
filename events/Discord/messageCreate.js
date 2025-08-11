const { Events, EmbedBuilder } = require('discord.js');
const { translateToTelegramEmoji, processForTelegram, translateUrgencyEmoji, getUrgencyColor, processLineKeywords } = require('../../utils/messageFormatters');
const telegramBot = require('../../Telegram/bot');

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        if (message.author.bot) return;
        const { client } = message;
        const prefix = '!';

        if (message.content.startsWith(prefix)) {
            const args = message.content.slice(prefix.length).trim().split(/ +/);
            const commandName = args.shift().toLowerCase();
            const command = client.prefixCommands.get(commandName);
            if (!command) return;
            try {
                await command.execute(message, args);
            } catch (error) {
                console.error('Prefix command error:', error);
                await message.reply('Command error');
            }
        }

        if (message.channel.id !== '1377398484931575938') return;
        const targetChannel = await client.channels.fetch('1347146518943105085');
        if (!targetChannel) return;

        try {
            let urgency = '';
            const firstChar = message.content.split(" ")[0].trim();
            if (firstChar) urgency = translateUrgencyEmoji(firstChar);

            let title = '';
            let content = message.content;
            const titleMatch = content.match(/\$&(.*?)\$&/);
            if (titleMatch) {
                title = titleMatch[1].trim();
                content = content.replace(titleMatch[0], '').trim();
            }

            content = processLineKeywords(content);

            const embed = new EmbedBuilder()
                .setDescription(content)
                .setColor(getUrgencyColor(urgency))
                .setTimestamp();

            if (title) embed.setTitle(title);
            if (urgency) embed.setAuthor({ name: `Urgency: ${urgency}` });

            const options = { embeds: [embed] };
            if (message.attachments.size > 0) {
                options.files = [...message.attachments.values()];
            }

            await targetChannel.send(options);

            let telegramMessage = '';
            if (firstChar) {
                const telegramEmoji = translateToTelegramEmoji(firstChar);
                telegramMessage += `${telegramEmoji} `;
            }

            telegramMessage += `<b>Información Metro</b>\n`;
            if (title) telegramMessage += `<b>${title}</b>\n`;

            const telegramContent = processForTelegram(content);
            telegramMessage += telegramContent;

            await telegramBot.sendToChannel(telegramMessage, {
                reply_markup: {
                    inline_keyboard: [[
                        { text: 'Ver en Discord', url: message.url }
                    ]]
                }
            });

        } catch (error) {
            console.error('Error forwarding message:', error);
        }
    },
};
