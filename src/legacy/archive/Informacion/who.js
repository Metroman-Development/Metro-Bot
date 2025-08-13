const { SlashCommandBuilder } = require('discord.js');
const whoIs = require('./_whis');
const whoRoles = require('./_whroles');
const whoAvatar = require('./_whavatar');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('who')
        .setDescription('Comandos de información de usuario')
        .addSubcommand(sub => whoIs.data(sub))
        .addSubcommand(sub => whoRoles.data(sub))
        .addSubcommand(sub => whoAvatar.data(sub)),

    category: "Información",

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const subcommands = {
            'is': whoIs,
            'roles': whoRoles,
            'avatar': whoAvatar
        };

        if (subcommands[subcommand]) {
            return subcommands[subcommand].execute(interaction);
        }

        await interaction.reply({
            content: '⚠️ Subcomando no reconocido',
            ephemeral: true
        });
    }
};
