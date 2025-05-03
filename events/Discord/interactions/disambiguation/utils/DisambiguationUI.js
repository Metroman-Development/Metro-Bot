const { EmbedBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

class DisambiguationUI {
    static MAX_OPTIONS_PER_PAGE = 5;

    static create(query, matches) {
        const currentPageMatches = matches.slice(0, this.MAX_OPTIONS_PER_PAGE);
        const sessionId = Date.now();

        const embed = new EmbedBuilder()
            .setTitle(`Multiple matches found for "${query}"`)
            .setDescription('Please select an option:')
            .setColor(0x5865F2);

        currentPageMatches.forEach((match, index) => {
            embed.addFields({
                name: `Option ${index + 1}`,
                value: this._formatMatch(match),
                inline: true
            });
        });

        const components = [
            currentPageMatches.map((_, index) => 
                new ButtonBuilder()
                    .setCustomId(`disambig:select:${sessionId}:${index}`)
                    .setLabel(`${index + 1}`)
                    .setStyle(ButtonStyle.Secondary)
            ),
            [
                new ButtonBuilder()
                    .setCustomId(`disambig:cancel:${sessionId}`)
                    .setLabel('Cancel')
                    .setStyle(ButtonStyle.Danger)
            ]
        ];

        return { embed, components };
    }

    static _formatMatch(match) {
        return [
            match.name && `**Name:** ${match.name}`,
            match.line && `**Line:** ${match.line}`,
            match.id && `**ID:** ${match.id}`
        ].filter(Boolean).join('\n') || 'No additional information';
    }
}

module.exports = DisambiguationUI;