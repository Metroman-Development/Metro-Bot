const { SlashCommandBuilder } = require('discord.js');
const BaseCommand = require('../../BaseCommand');
const info = require('./_botinfo');
const comandos = require('./_botcomandos');
const iconografia = require('./_boticonografia');

class BotCommand extends BaseCommand {
    constructor() {
        super(new SlashCommandBuilder()
            .setName('bot')
            .setDescription('Comandos de información del bot')
        );
        this.category = "Bot Info";

        this.addSubcommand(info);
        this.addSubcommand(comandos);
        this.addSubcommand(iconografia);
    }
}

module.exports = new BotCommand();