const AccessCore = require('./accessCore');
const { EmbedBuilder } = require('discord.js');

class ListHandler extends AccessCore {
    constructor() {
        super();
        this.currentPage = 0;
        this.filter = '';
        this.issues = [];
        this.message = null;
    }

    async handle(message, args) {
        this.filter = args[0] || '';
        this.message = message;
        this.currentPage = 0;

        // Get all access files
        const files = await fs.readdir(path.join(__dirname, '../../data/json/accessDetails'));
        const accessFiles = files.filter(f => f.startsWith('access_') && f.endsWith('.json'));

        // Process all stations
        this.issues = [];
        for (const file of accessFiles) {
            const data = await fs.readFile(
                path.join(__dirname, '../../data/json/accessDetails', file), 
                'utf8'
            );
            const config = JSON.parse(data);
            const stationKey = `${config.station} ${config.line}`;

            const problemElevators = config.elevators.filter(e => 
                this.filter ? 
                e.status.toLowerCase().includes(this.filter.toLowerCase()) : 
                !e.status.toLowerCase().includes('operativa')
            );

            const problemEscalators = config.escalators.filter(e => 
                this.filter ? 
                e.status.toLowerCase().includes(this.filter.toLowerCase()) : 
                !e.status.toLowerCase().includes('operativa')
            );

            if (problemElevators.length > 0 || problemEscalators.length > 0) {
                this.issues.push({
                    station: stationKey,
                    elevators: problemElevators,
                    escalators: problemEscalators,
                    lastUpdated: config.lastUpdated
                });
            }
        }

        // Sort by last updated (newest first)
        this.issues.sort((a, b) => new Date(b.lastUpdated) - new Date(a.lastUpdated));

        if (this.issues.length === 0) {
            return this.sendSuccess(
                message, 
                '✅ Todas las estaciones tienen su infraestructura operativa' + 
                (this.filter ? ` (filtro: ${this.filter})` : '')
            );
        }

        const embed = this.createEmbed();
        const sentMessage = await message.reply({ embeds: [embed] });

        // Add pagination if needed
        if (this.issues.length > 10) {
            await sentMessage.react('⬅️');
            await sentMessage.react('➡️');
            
            const filter = (reaction, user) => {
                return ['⬅️', '➡️'].includes(reaction.emoji.name) && 
                       user.id === message.author.id;
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
                              this.currentPage < Math.ceil(this.issues.length / 10) - 1) {
                        this.currentPage++;
                    }

                    const updatedEmbed = this.createEmbed();
                    await sentMessage.edit({ embeds: [updatedEmbed] });
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

    createEmbed() {
        const startIdx = this.currentPage * 10;
        const pageIssues = this.issues.slice(startIdx, startIdx + 10);
        const totalPages = Math.ceil(this.issues.length / 10);

        const embed = new EmbedBuilder()
            .setColor(0xFFA500)
            .setTitle(`⚠️ Estaciones con problemas${this.filter ? ` (filtro: ${this.filter})` : ''}`)
            .setFooter({ 
                text: `Página ${this.currentPage + 1}/${totalPages} | ` +
                      `Total: ${this.issues.length} estaciones`
            });

        for (const issue of pageIssues) {
            const problemText = [
                ...issue.elevators.map(e => 
                    `🛗 **${e.id}**: ${e.from}→${e.to} - _${e.status}_` +
                    (e.notes ? `\n📝 ${e.notes}` : '')
                ),
                ...issue.escalators.map(e => 
                    `🔼 **${e.id}**: ${e.from}→${e.to} - _${e.status}_` +
                    (e.notes ? `\n📝 ${e.notes}` : '')
                )
            ].join('\n');

            embed.addFields({
                name: `${issue.station}`,
                value: problemText || 'No hay detalles disponibles',
                inline: false
            });
        }

        return embed;
    }
}

module.exports = ListHandler;