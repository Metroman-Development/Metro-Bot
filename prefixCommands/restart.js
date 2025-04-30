module.exports = {

    name: 'restart', // Command name

    description: 'Restarts the bot',

    async execute(message, args) {

        // Check if the user has permission to restart the bot

        if (!message.member.permissions.has('ADMINISTRATOR')) {

            return message.reply('You do not have permission to restart the bot.');

        }

        // Notify that the bot is restarting

        await message.reply('Restarting bot...');

        // Exit the process (use a process manager like pm2 to restart the bot)

        process.exit(0);

    }

};