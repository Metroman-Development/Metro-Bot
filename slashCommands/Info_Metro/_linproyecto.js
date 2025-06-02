const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const projectLines = require('../../modules/metro/data/json/lineasproyectoMetro.json');
const ImageProcessor = require('../../utils/imageProcessor');
const metroConfig = require('../../config/metro/metroConfig');

module.exports = {
    parentCommand: 'linea',
    data: (subcommand) => subcommand
        .setName('proyecto')
        .setDescription('Muestra información de líneas en proyecto')
        .addStringOption(option =>
            option.setName('linea')
                .setDescription('Selecciona una línea en proyecto del Metro de Santiago')
                .setRequired(true)
                .addChoices(
                    { name: '🚇 Línea 7', value: 'l7' },
                    { name: '🚇 Línea 8', value: 'l8' },
                    { name: '🚇 Línea 9', value: 'l9' }, 
                    { name: '🚇 Línea A', value: 'la' }
 
                )
        ),

    async execute(interaction) {
        try {
            await interaction.deferReply();

            const lineKey = interaction.options.getString('linea');
            const lineInfo = projectLines[lineKey];
            const lineEmoji = metroConfig.linesEmojis[lineKey] || '🚇';
            
            if (!lineInfo) {
                return await interaction.editReply({
                    content: '❌ No se encontró información para esta línea en proyecto',
                    ephemeral: true
                });
            }

            // Generate GitHub image URL
            const lineNumber = lineKey.slice(1);
            const imageUrl = `https://raw.githubusercontent.com/MetroManSR/MetroWeb/main/metrobot/assets/L%C3%ADnea_${lineNumber}_del_Metro_de_Santiago.svg.png`;


            if (lineKey!=="la" ) {
            // Process image
            const lineImage = await ImageProcessor.processForDiscord(imageUrl, {
                filename: `${lineKey}_proyecto.png`,
                description: `Mapa de Línea ${lineNumber} (Proyecto)`,
                backgroundColor: '#FFFFFF',
                resize: { width: 800, height: 300, fit: 'contain' }
            });

            // Create optimized embed with enhanced visuals
            const embed = new EmbedBuilder()
                .setTitle(`${lineEmoji} Línea ${lineNumber} (En proyecto) • ${lineInfo.Estreno}`)
                .setColor(this._getColorCode(lineInfo.Color))
                //.setThumbnail(metroConfig.metroLogo.v4)
                .setImage(`attachment://${lineKey}_proyecto.png`)
                .setDescription(this._buildDescription(lineInfo));

       } else {


// Create optimized embed with enhanced visuals
            const embed = new EmbedBuilder()
                .setTitle(`${lineEmoji} Línea ${lineNumber} (En proyecto) • ${lineInfo.Estreno}`)
                .setColor(this._getColorCode(lineInfo.Color))
                //.setThumbnail(metroConfig.metroLogo.v4)
                  .setDescription(this._buildDescription(lineInfo));

               } 
                 
            // Set footer with project-specific icon
            embed.setFooter({ 
                text: 'Sistema Metro de Santiago - Proyectos futuros', 
                iconURL: metroConfig.metroLogo.v4
            }).setTimestamp();

            if (lineKey==="la" ) {


                
               await interaction.editReply({ 
                embeds: [embed],
                 })

               } else{

            
            await interaction.editReply({ 
                embeds: [embed],
                files: [lineImage]
            });} 

        } catch (error) {
            console.error('Error en comando linea proyecto:', error);
            await interaction.editReply({
                content: '❌ Ocurrió un error al obtener la información de la línea en proyecto',
                ephemeral: true
            });
        }
    },

    _buildDescription(lineInfo) {
    const descriptionParts = [
        `**🎨 Color:** \`${lineInfo.Color}\` ${this._getColorSquare(this._getColorCode(lineInfo.Color))}`,
        `**📏 Longitud:** ${lineInfo.Longitud}`,
        `**🚉 Estaciones:** ${lineInfo["N° estaciones"]}`,
        `**⚡ Electrificación:** ${lineInfo.Electrificación}`,
        '',
        `**🏙️ Comunas:**\n${lineInfo.Comunas?.join(', ') || 'N/A'}`,
        '',
        `**🚂 Flota:**\n${lineInfo.Flota?.map(train => `▸ ${metroConfig.emoji.tren} ${train}`).join('\n') || 'Por definir'}`,
        '',
        `**🔗 Interconexiones:**\n${
            lineInfo.Interconexiones 
                ? Object.entries(lineInfo.Interconexiones)
                    .map(([line, stations]) => {
                        
                        
                        //console.log(line) 
                        // Handle both "linea X" and "lX" formats
                        const lineKey = line.toLowerCase().startsWith('línea') 
                            ? `l${line.replace('Línea', '').replace("(futura)", "").trim()}`
                            : line.startsWith('l') ? line : `l${line}`;
                        const lineEmoji = metroConfig.linesEmojis[lineKey.toLowerCase()] || '🚇';
                        return `▸ ${lineEmoji} **${line}:** ${stations.join(', ')}`;
                    })
                    .join('\n')
                : 'N/A'
        }`,
        '',
        `**📌 Características:**\n${lineInfo.Características || 'Por definir'}`
    ];

    return descriptionParts.join('\n');
},

    _getColorCode(colorName) {
        const colorMap = {
            'Gris': '#808080',
            'Naranjo': '#FFA500',
            'Rosado': '#FFC0CB',
            'default': '#0099FF'
        };
        return colorMap[colorName] || colorMap.default;
    },

    _getColorSquare(colorHex) {
        return "" 
    }
};
