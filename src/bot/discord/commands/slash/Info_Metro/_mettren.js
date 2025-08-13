const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const metroConfig = require('../../../../../config/metro/metroConfig');
const styles = { defaultTheme: { primaryColor: '#000000' } };

module.exports = {
    parentCommand: 'metro',
    data: (subcommand) => subcommand
        .setName('tren')
        .setDescription('Información técnica sobre modelos de trenes')
        .addStringOption(option =>
            option.setName('modelo')
                .setDescription('Selecciona un modelo de tren')
                .addChoices(
                    { name: 'NS-74', value: 'NS-74' },
                    { name: 'NS-93', value: 'NS-93' },
                    { name: 'NS-88', value: 'NS-88' },
                    { name: 'AS-02', value: 'AS-02' },
                    { name: 'NS-04', value: 'NS-04' },
                    { name: 'NS-07', value: 'NS-07' },
                    { name: 'NS-12', value: 'NS-12' },
                    { name: 'AS-14', value: 'AS-14' },
                    { name: 'NS-16', value: 'NS-16' }
                )
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('vista')
                .setDescription('Qué información mostrar')
                .addChoices(
                    { name: 'Resumen', value: 'summary' },
                    { name: 'Especificaciones', value: 'specs' },
                    { name: 'Técnico', value: 'technical' },
                    { name: 'Operacional', value: 'operational' },
                    { name: 'Imagen', value: 'image' }
                )
        ),

    async execute(interaction, metro) {
        try {
            await interaction.deferReply();
            
            const model = interaction.options.getString('modelo');
            const viewType = interaction.options.getString('vista') || 'summary';
            const trainData = metro._combinedData.trains || {};
            const trainInfo = trainData[model];

            if (!trainInfo) {
                return interaction.editReply({
                    content: `ℹ️ No se encontró información para el modelo ${model}`,
                    ephemeral: true
                });
            }

            const embed = new EmbedBuilder()
                .setTitle(`${metroConfig.logoMetroEmoji} ${model}`)
                .setColor(styles.defaultTheme.primaryColor);

            // Show image in all views except pure technical ones
            if (viewType !== 'technical' && viewType !== 'operational' && trainInfo.images?.exterior) {
                embed.setImage(trainInfo.images.exterior);
            }

            switch (viewType) {
                case 'summary':
                    this._buildSummaryView(embed, trainInfo);
                    break;
                case 'specs':
                    this._buildSpecsView(embed, trainInfo);
                    break;
                case 'technical':
                    this._buildTechnicalView(embed, trainInfo);
                    break;
                case 'operational':
                    this._buildOperationalView(embed, trainInfo);
                    break;
                case 'image':
                    // Only image is already set above
                    break;
            }

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Error en comando tren:', error);
            await interaction.editReply({
                content: '❌ Error al obtener datos del tren',
                ephemeral: true
            });
        }
    },

    _buildSummaryView(embed, trainInfo) {
        embed.setDescription(`**Información básica del modelo ${trainInfo.id}**`)
            .addFields(
                {
                    name: '🏭 Fabricante',
                    value: trainInfo.generalInfo?.manufacturer || 'Desconocido',
                    inline: true
                },
                {
                    name: '📅 Años de fabricación',
                    value: trainInfo.generalInfo?.manufacturingYears || 'Desconocido',
                    inline: true
                },
                {
                    name: '🛤️ Tipo de servicio',
                    value: trainInfo.generalInfo?.serviceType || 'N/A',
                    inline: true
                },
                {
                    name: '⚡ Propulsión',
                    value: trainInfo.technicalSpecs?.propulsionType || 'N/A',
                    inline: true
                },
                {
                    name: '🚄 Configuración',
                    value: trainInfo.composition?.configurations?.[0]?.split(':')[1]?.trim() || 'N/A',
                    inline: true
                },
                {
                    name: '👥 Capacidad',
                    value: this._formatCapacity(trainInfo.comfortFeatures?.standingCapacity),
                    inline: true
                }
            );
    },

    _buildSpecsView(embed, trainInfo) {
        embed.setDescription(`**Especificaciones técnicas del modelo ${trainInfo.id}**`)
            .addFields(
                {
                    name: '📊 Rendimiento',
                    value: `• Velocidad máxima: ${trainInfo.technicalSpecs?.maxSpeed || 'N/A'}\n` +
                           `• Potencia: ${trainInfo.electricalSystems?.powerOutput || 'N/A'}\n` +
                           `• Transmisión: ${trainInfo.technicalSpecs?.transmission || 'N/A'}`,
                    inline: true
                },
                {
                    name: '🔌 Sistema eléctrico',
                    value: `• Voltaje: ${trainInfo.electricalSystems?.voltage || 'N/A'}\n` +
                           `• Tipo de motor: ${trainInfo.electricalSystems?.motorType || 'N/A'}\n` +
                           `• Motores: ${trainInfo.electricalSystems?.motorCount || 'N/A'}`,
                    inline: true
                },
                {
                    name: '🛑 Frenos',
                    value: trainInfo.technicalSpecs?.brakingSystems?.join(', ') || 'N/A',
                    inline: false
                }
            );
    },

    _buildTechnicalView(embed, trainInfo) {
        embed.setDescription(`**Detalles técnicos del modelo ${trainInfo.id}**`)
            .addFields(
                {
                    name: '📏 Dimensiones',
                    value: `• Longitud: ${this._formatDimensions(trainInfo.dimensions?.length)}\n` +
                           `• Ancho: ${trainInfo.dimensions?.width || 'N/A'}\n` +
                           `• Altura: ${trainInfo.dimensions?.height || 'N/A'}`,
                    inline: true
                },
                {
                    name: '⚖️ Pesos',
                    value: `• Peso: ${this._formatWeight(trainInfo.weightData?.emptyWeight)}\n` +
                           `• Carga por eje: ${trainInfo.weightData?.axleLoad || 'N/A'}`,
                    inline: true
                },
                {
                    name: '🚂 Composición',
                    value: trainInfo.composition?.configurations?.map(c => `• ${c}`).join('\n') || 'N/A',
                    inline: false
                },
                {
                    name: '🛡️ Seguridad',
                    value: trainInfo.safetyFeatures?.protectionSystems?.join(', ') || 'N/A',
                    inline: true
                }
            );
    },

    _buildOperationalView(embed, trainInfo) {
        embed.setDescription(`**Datos operacionales del modelo ${trainInfo.id}**`)
            .addFields(
                {
                    name: '🏗️ Fabricación',
                    value: `• Unidades construidas: ${trainInfo.operationalData?.totalUnits || 'N/A'}\n` +
                           `• Trenes en servicio: ${trainInfo.operationalData?.activeTrains || '0'}`,
                    inline: true
                },
                {
                    name: '🛠️ Características',
                    value: `• Climatización: ${trainInfo.comfortFeatures?.climateControl || 'N/A'}\n` +
                           `• Espacios PMR: ${trainInfo.comfortFeatures?.wheelchairSpaces || 'N/A'}`,
                    inline: true
                },
                {
                    name: '🔢 Matriculación',
                    value: trainInfo.generalInfo?.registrationNumbers || 'N/A',
                    inline: false
                }
            );
    },

    _formatCapacity(capacity) {
        if (!capacity) return 'N/A';
        if (typeof capacity === 'object') {
            return Object.entries(capacity).map(([k, v]) => `${k}: ${v}`).join('\n');
        }
        return capacity.toString();
    },

    _formatDimensions(dim) {
        if (!dim) return 'N/A';
        if (typeof dim === 'object') {
            return Object.values(dim)[0] || 'N/A';
        }
        return dim;
    },

    _formatWeight(weight) {
        if (!weight) return 'N/A';
        if (typeof weight === 'object') {
            return Object.values(weight)[0] || 'N/A';
        }
        return weight;
    }
};