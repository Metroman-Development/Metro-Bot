const { SlashCommandBuilder } = require('discord.js');
const BaseCommand = require('../BaseCommand');
const serverButtonsHandler = require('../../../../events/interactions/buttons/serverButtons.js');

class ServerInfoCommand extends BaseCommand {
    constructor() {
        super(new SlashCommandBuilder()
            .setName('serverinfo')
            .setDescription('Muestra información detallada del servidor')
        );
        this.category = "Información";
        this.active = true;
    }

    async run(interaction) {
        await interaction.deferReply();
        const messagePayload = serverButtonsHandler.build(interaction);
        await interaction.editReply(messagePayload);
    }
}

module.exports = new ServerInfoCommand();