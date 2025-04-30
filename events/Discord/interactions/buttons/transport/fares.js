// Versión nueva (/buttons/transport/fares.js)
// handlers/buttons/fares.js
const { ToggleTemplate } = require('../../templates/toggle');
const FareEmbed = require('../../templates/embeds/FareEmbed');
const BaseCommand = require('../../templates/baseCommand');
const { getCache } = require('../../utils/cache');

module.exports = ToggleTemplate.create({
    idPrefix: 'fare_type',
    options: [
        { id: 'metro', label: 'Metro', emoji: '🚇' },
        { id: 'combi', label: 'Combinación', emoji: '🔄' },
        { id: 'estudiante', label: 'Estudiante', emoji: '🎓' },
        { id: 'adulto', label: 'Adulto Mayor', emoji: '👴' },
        { id: 'adultobip', label: 'Adulto BIP', emoji: '💳' },
        { id: 'transantiago', label: 'Transantiago', emoji: '🚌' }
    ],
    maxOptionsPerRow: 5, // Split into multiple rows if more than 5 options
    
    async onToggle(interaction, selectedId) {
        const baseCommand = new BaseCommand();
        
        try {
            // Get cached data from the original command
            const cachedData = await getCache(interaction.user.id, interaction.message.interaction?.id);
            
            if (!cachedData || cachedData.command !== 'tarifario') {
                return interaction.reply({
                    content: '⚠️ La sesión de tarifas ha expirado. Por favor ejecuta el comando /tarifario nuevamente.',
                    ephemeral: true
                });
            }

            const metro = interaction.client.metro;
            const fareEmbed = new FareEmbed(metro);
            
            // Map the toggle IDs to the fare types used in the system
            const fareTypeMap = {
                metro: 'metro',
                combi: 'combinacion',
                estudiante: 'estudiante',
                adulto: 'adulto',
                adultobip: 'adultobip',
                transantiago: 'transantiago'
            };

            const systemFareType = fareTypeMap[selectedId] || 'metro';
            const embed = fareEmbed.create(systemFareType, cachedData.currentPeriod);
            
            await interaction.update({ embeds: [embed] });
            
            // Update the cache with the new selection
            await baseCommand.cacheInteraction(interaction, {
                ...cachedData,
                fareType: systemFareType
            });

        } catch (error) {
            console.error('Error in fare toggle:', error);
            await interaction.update({
                content: '⚠️ Error al cambiar el tipo de tarifa',
                components: []
            });
        }
    },

    // Additional method to create the initial toggle buttons
    static async createInitialButtons(interaction) {
        const baseCommand = new BaseCommand();
        const userId = interaction.user.id;
        const embedId = interaction.id;
        
        const options = this.options.map(opt => ({
            customId: `${this.idPrefix}_${opt.id}_${userId}_${embedId}`,
            label: opt.label,
            emoji: opt.emoji,
            style: 'Primary'
        }));

        // Split buttons into multiple rows if needed
        const rows = [];
        let currentRow = [];
        
        options.forEach((option, index) => {
            if (index > 0 && index % this.maxOptionsPerRow === 0) {
                rows.push(currentRow);
                currentRow = [];
            }
            currentRow.push(option);
        });

        if (currentRow.length > 0) {
            rows.push(currentRow);
        }

        return rows.map(row => new ActionRowBuilder().addComponents(
            row.map(opt => new ButtonBuilder()
                .setCustomId(opt.customId)
                .setLabel(opt.label)
                .setEmoji(opt.emoji)
                .setStyle(opt.style)
            )
        ));
    }
});