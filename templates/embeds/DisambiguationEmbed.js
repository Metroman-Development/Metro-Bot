// templates/embeds/DisambiguationEmbed.js
const BaseEmbed = require('./baseEmbed');

class DisambiguationEmbed extends BaseEmbed {
    create(query, matches, interaction) {
        const slicedMatches = matches.slice(0, 4);
        const description = slicedMatches.map((match, index) => 
            `**${index + 1}.** 🚉 ${match.original} (Línea ${match.line})`
        ).join('\n');

        return {
            embed: this.createEmbed({
                title: `Disambiguation: ${query}`,
                description: `Múltiples coincidencias encontradas. Por favor, selecciona la estación correcta:\n\n${description}`,
                color: 0x0099FF
            }),
            actionRows: [this._createButtons(slicedMatches, interaction)]
        };
    }

    _createButtons(matches, interaction) {
        return new ActionRowBuilder().addComponents(
            matches.map((_, index) => 
                new ButtonBuilder()
                    .setCustomId(`station_${interaction.user.id}_${interaction.id}_${index}`)
                    .setLabel(`${index + 1}️⃣`)
                    .setStyle(ButtonStyle.Primary)
            )
        );
    }
}

module.exports = DisambiguationEmbed;