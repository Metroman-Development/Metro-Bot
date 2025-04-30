// _lininfo (3).js
const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const ImageProcessor = require('../../utils/imageProcessor');
const horMap = require('../../config/metro/lineHorMap');
const metroConfig = require('../../config/metro/metroConfig');

module.exports = {
    parentCommand: 'linea',
    data: (subcommand) => subcommand
        .setName('info')
        .setDescription('Muestra información de lineas del Metro de Santiago')
        .addStringOption(option =>
            option.setName('linea')
                .setDescription('Selecciona una línea')
                .setRequired(true)
                .addChoices(
                    { name: '🚇 Línea 1', value: 'l1' },
                    { name: '🚇 Línea 2', value: 'l2' },
                    { name: '🚇 Línea 3', value: 'l3' },
                    { name: '🚇 Línea 4', value: 'l4' },
                    { name: '🚇 Línea 4A', value: 'l4a' },
                    { name: '🚇 Línea 5', value: 'l5' },
                    { name: '🚇 Línea 6', value: 'l6' },
                )
        ),

    async execute(interaction, metro) {
        try {
            await interaction.deferReply();

            const lineKey = interaction.options.getString('linea');
            const lineInfo = metro?._staticData.lines[lineKey];
            const lineEmoji = metroConfig.linesEmojis[lineKey] || '🚇';
            
            if (!lineInfo) {
                return await interaction.editReply({
                    content: '❌ No se encontró información para esta línea',
                    ephemeral: true
                });
            }

            // Generate GitHub URL dynamically
            let lineNumber = lineKey.replace('l', '').toUpperCase();
            if (lineKey === 'l4a') lineNumber = '4A';
            const githubImageUrl = `https://raw.githubusercontent.com/MetroManSR/MetroWeb/main/metrobot/assets/L%C3%ADnea_${lineNumber}_del_Metro_de_Santiago.svg.png`;

            // Process image
            const lineImage = await ImageProcessor.processForDiscord(githubImageUrl, {
                filename: `${lineKey}_map.png`,
                description: `Mapa de ${lineInfo.displayName}`,
                backgroundColor: '#FFFFFF',
                resize: {
                    width: 800,
                    height: 300,
                    fit: 'contain'
                }
            });

            if (!lineImage) {
                // Fallback to original horMap if GitHub fails
                const fallbackImage = await ImageProcessor.processForDiscord(horMap[lineKey], {
                    filename: `${lineKey}_map.png`,
                    description: `Mapa de ${lineInfo.displayName}`,
                    backgroundColor: '#FFFFFF',
                    resize: {
                        width: 800,
                        height: 300,
                        fit: 'contain'
                    }
                });

                if (!fallbackImage) {
                    console.error(`Failed to process both GitHub and fallback image for ${lineKey}`);
                    return await interaction.editReply({
                        content: '❌ Error al cargar el mapa de la línea',
                        ephemeral: true
                    });
                }
            }

            // Build rich embed with enhanced visuals
            const embed = new EmbedBuilder()
                .setTitle(`${lineEmoji} ${lineInfo.displayName}`)
                .setColor(lineInfo.color || '#0099FF')
                //.setThumbnail(metroConfig.metroLogo.principal)
                .setImage(`attachment://${lineKey}_map.png`)
                .addFields(
                    {
                        name: `${metroConfig.stationIcons[lineInfo.status.code]?.emoji || '📊'} Estado`,
                        value: `${this._getStatusEmoji(lineInfo.status.code)} ${metroConfig.statusMapping[lineInfo.status.code]?.message || lineInfo.status.appMessage || 'Estado desconocido'}`,
                        inline: true
                    },
                    {
                        name: '🎨 Color',
                        value: `\`${lineInfo.color}\` ${this._getColorSquare(lineInfo.color)}`,
                        inline: true
                    },
                    {
                        name: '📏 Longitud',
                        value: lineInfo.details.length || 'N/A',
                        inline: true
                    },
                    {
                        name: '🚉 Estaciones',
                        value: lineInfo.details.stations || 'N/A',
                        inline: true
                    },
                    {
                        name: '📅 Inauguración',
                        value: lineInfo.details.inauguration || 'N/A',
                        inline: true
                    }
                );

            // Add communes if available
            if (lineInfo.details.communes?.length > 0) {
                embed.addFields({
                    name: '🏙️ Comunas',
                    value: lineInfo.details.communes.join(', '),
                    inline: false
                });
            }

            // Add metadata footer with logo
            embed.setFooter({ 
                text: 'Metro de Santiago • Última actualización', 
                iconURL: metroConfig.metroLogo.principal
            }).setTimestamp();

            await interaction.editReply({
                embeds: [embed],
                files: [lineImage || fallbackImage]
            });

        } catch (error) {
            console.error('Error en comando linea info:', error);
            await interaction.editReply({
                content: '❌ Ocurrió un error al obtener la información',
                ephemeral: true
            });
        }
    },

    _getStatusEmoji(statusCode) {
        const statusMap = metroConfig.statusMapping;
        return statusMap[statusCode]?.emoji || '⚪';
    },

    _getColorSquare(colorHex) {
        return ""
    }
};