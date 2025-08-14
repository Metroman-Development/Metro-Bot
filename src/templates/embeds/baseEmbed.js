const { EmbedBuilder } = require('discord.js');

class BaseEmbed extends EmbedBuilder {
    constructor() {
        super();
        this.setColor(0x0052A5);
    }
}

module.exports = BaseEmbed;
