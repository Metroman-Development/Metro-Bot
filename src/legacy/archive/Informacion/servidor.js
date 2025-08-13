const { SlashCommandBuilder } = require('discord.js');

const serverInfo = require('./_svinfo');

const serverRoles = require('./_svroles');

const serverChannels = require('./_svchannels');

const serverMembers = require('./_svmembers');

const serverEmojis = require('./_svemojis');

module.exports = {

    data: new SlashCommandBuilder()

        .setName('servidor')

        .setDescription('Comandos de información del servidor')

        .addSubcommand(sub => serverInfo.data(sub))

        .addSubcommand(sub => serverRoles.data(sub))

        .addSubcommand(sub => serverChannels.data(sub))

        .addSubcommand(sub => serverMembers.data(sub))

        .addSubcommand(sub => serverEmojis.data(sub)),



    category: "Información",



    async execute(interaction) {

        const subcommand = interaction.options.getSubcommand();

        const subcommands = {

            'info': serverInfo,

            'roles': serverRoles,

            'canales': serverChannels,

            'miembros': serverMembers,

            'emojis': serverEmojis

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
