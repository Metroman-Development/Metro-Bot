//const { getClient } = require('../../utils/clientManager');
/*
module.exports = {
    name: 'messageCreate',
    async execute(message, client) {
        if (!client) client = getClient();
        
        // Ignore messages from bots
        if (message.author.bot) return;

        // Handle Bip!Coins for non-command messages
        if (!message.content.startsWith('!')) {
            // Your Bip!Coins logic here (currently commented out)
            return;
        }

        // Extract the command name and arguments
        const args = message.content.slice('!'.length).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();

        // Get the command from the prefixCommands collection
        const command = client.prefixCommands.get(commandName) || 
                        client.prefixCommands.find(cmd => cmd.aliases?.includes(commandName));

        if (!command) return; // Command not found

        // Execute the command
        try {
            await command.execute(message, args, client);
        } catch (error) {
            console.error(`❌ Error executing command ${commandName}:`, error);
            message.reply('❌ There was an error executing the command.');
        }
    }
}*/