const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const TarifarioEmbed = require('../../../../../templates/embeds/TarifarioEmbed');

module.exports = {
    customId: 'fare_', // fare_[type]_[period]
    
    async execute(interaction, client) {
        const [_, fareType, period] = interaction.customId.split('_');
        const tarifario = new TarifarioEmbed(client.metro.config);
        
        try {
            // 1. Get current fare data
            const fares = await client.metro.getFares();
            const periodData = await client.metro.getPeriodInfo();
            
            // 2. Handle different interaction types
            if (fareType === 'overview') {
                const embed = tarifario.createOverview(periodData, fares);
                await interaction.update({
                    embeds: [embed],
                    components: this._buildFareTypeButtons(periodData.period)
                });
            } else {
                const fareValue = fares[`t_${fareType}_${period.toLowerCase()}`] ?? 
                                 fares[`t_${fareType}_normal`];
                
                const embed = tarifario.createDetailView(
                    fareType, 
                    periodData, 
                    fareValue
                );
                
                await interaction.update({
                    embeds: [embed],
                    components: [
                        this._buildBackButton(periodData.period),
                        ...this._buildRelatedFaresButtons(fareType, periodData.period)
                    ]
                });
            }
        } catch (error) {
            console.error('Fare interaction error:', error);
            await interaction.update({
                content: '⚠️ Error al cargar tarifas',
                components: []
            });
        }
    },

    _buildFareTypeButtons(currentPeriod) {
        const fareTypes = [
            { id: 'metro', label: '🚇 Normal', emoji: '🚇' },
            { id: 'combinacion', label: '🔄 Combinada', emoji: '🔄' },
            { id: 'estudiante', label: '🎓 Estudiantil', emoji: '🎓' },
            { id: 'adulto', label: '👴 Adulto Mayor', emoji: '👴' },
            { id: 'adultobip', label: '💳 BIP!', emoji: '💳' },
            { id: 'transantiago', label: '🚌 Transantiago', emoji: '🚌' }
        ];

        return [
            new ActionRowBuilder().addComponents(
                fareTypes.map(fare => (
                    new ButtonBuilder()
                        .setCustomId(`fare_${fare.id}_${currentPeriod}`)
                        .setLabel(fare.label)
                        .setEmoji(fare.emoji)
                        .setStyle(ButtonStyle.Primary)
                ))
            ),
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('fare_overview_')
                    .setLabel('Ver Resumen')
                    .setStyle(ButtonStyle.Secondary)
            )
        ];
    },

    _buildBackButton(currentPeriod) {
        return new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`fare_overview_${currentPeriod}`)
                .setLabel('← Volver al resumen')
                .setStyle(ButtonStyle.Danger)
        );
    },

    _buildRelatedFaresButtons(currentFareType, currentPeriod) {
        const relatedFares = {
            metro: ['combinacion', 'adultobip'],
            combinacion: ['metro', 'estudiante'],
            estudiante: ['adulto', 'combinacion'],
            adulto: ['estudiante', 'adultobip'],
            adultobip: ['metro', 'adulto'],
            transantiago: ['metro', 'combinacion']
        };

        return [
            new ActionRowBuilder().addComponents(
                (relatedFares[currentFareType] || []).map(fareType => (
                    new ButtonBuilder()
                        .setCustomId(`fare_${fareType}_${currentPeriod}`)
                        .setLabel(this._getFareLabel(fareType))
                        .setStyle(ButtonStyle.Secondary)
                ))
            )
        ];
    },

    _getFareLabel(fareType) {
        const labels = {
            metro: 'Normal',
            combinacion: 'Combinada',
            estudiante: 'Estudiantil',
            adulto: 'Adulto Mayor',
            adultobip: 'BIP!',
            transantiago: 'Transantiago'
        };
        return labels[fareType] || fareType;
    }
};