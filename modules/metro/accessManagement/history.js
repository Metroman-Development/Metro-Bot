const AccessCore = require('./accessCore');
const { EmbedBuilder } = require('discord.js');

class HistoryHandler extends AccessCore {
    constructor() {
        super();
        this.currentPage = 0;
        this.message = null;
        this.history = [];
    }

    async handle(message, args) {
        const parsedArgs = this.parseQuotedArgs(args);
        const rawName = parsedArgs[0];
        const rawLine = parsedArgs[1];
        
        if (!rawName || !rawLine) {
            return this.sendError(message, 
                'Debes especificar nombre de estación y línea (ej: "San Pablo" l1)\n' +
                'Uso: m!stationaccess historial "Nombre Estación" línea'
            );
        }

        const stationKey = this.normalizeKey(`${rawName} ${rawLine}`);
        const config = await this.getAccessConfig(stationKey);

        if (!config) {
            return this.sendError(message, 
                `La estación ${rawName} ${rawLine} no tiene configuración.\n` +
                'Usa primero: m!stationaccess configurar "Nombre Estación" línea'
            );
        }

        if (!config.changeHistory || config.changeHistory.length === 0) {
            return this.sendError(message, 
                'No hay historial de cambios registrado para esta estación.'
            );
        }

        this.currentPage = 0;
        this.message = message;
        this.history = config.changeHistory.reverse(); // Show newest first

        return this.displayHistoryPage();
    }

    async displayHistoryPage() {
        const itemsPerPage = 5;
        const totalPages = Math.ceil(this.history.length / itemsPerPage);
        const startIdx = this.currentPage * itemsPerPage;
        const pageItems = this.history.slice(startIdx, startIdx + itemsPerPage);

        const embed = new EmbedBuilder()
            .setColor(0x6A5ACD)
            .setTitle(`📜 Historial de cambios: ${this.history[0].station || 'Estación Desconocida'}`)
            .setFooter({ 
                text: `Página ${this.currentPage + 1}/${totalPages} | ` +
                      `Total: ${this.history.length} cambios`
            });

        for (const change of pageItems) {
            embed.addFields({
                name: `${new Date(change.timestamp).toLocaleString('es-CL')} - ${change.user}`,
                value: `**${change.action}**: ${change.details}`,
                inline: false
            });
        }

        const sentMessage = await this.message.reply({ embeds: [embed] });

        // Add pagination if needed
        if (this.history.length > itemsPerPage) {
            await sentMessage.react('⬅️');
            await sentMessage.react('➡️');
            
            const filter = (reaction, user) => {
                return ['⬅️', '➡️'].includes(reaction.emoji.name) && 
                       user.id === this.message.author.id;
            };

            const collector = sentMessage.createReactionCollector({ 
                filter, 
                time: 60000 
            });

            collector.on('collect', async (reaction, user) => {
                try {
                    if (reaction.emoji.name === '⬅️' && this.currentPage > 0) {
                        this.currentPage--;
                    } else if (reaction.emoji.name === '➡️' && 
                              this.currentPage < totalPages - 1) {
                        this.currentPage++;
                    }

                    await sentMessage.edit({ embeds: [this.createHistoryEmbed()] });
                    await reaction.users.remove(user.id);
                } catch (error) {
                    console.error('Error handling pagination:', error);
                }
            });

            collector.on('end', () => {
                sentMessage.reactions.removeAll().catch(console.error);
            });
        }
    }

    createHistoryEmbed() {
        const itemsPerPage = 5;
        const startIdx = this.currentPage * itemsPerPage;
        const pageItems = this.history.slice(startIdx, startIdx + itemsPerPage);
        const totalPages = Math.ceil(this.history.length / itemsPerPage);

        const embed = new EmbedBuilder()
            .setColor(0x6A5ACD)
            .setTitle(`📜 Historial de cambios`)
            .setFooter({ 
                text: `Página ${this.currentPage + 1}/${totalPages} | ` +
                      `Total: ${this.history.length} cambios`
            });

        for (const change of pageItems) {
            embed.addFields({
                name: `${new Date(change.timestamp).toLocaleString('es-CL')} - ${change.user}`,
                value: `**${change.action}**: ${change.details}`,
                inline: false
            });
        }

        return embed;
    }
}

module.exports = HistoryHandler;