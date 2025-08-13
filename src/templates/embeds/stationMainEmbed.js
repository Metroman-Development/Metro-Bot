// templates/embeds/stationMainEmbed.js
const { EmbedBuilder } = require('discord.js');
const BaseEmbed = require('./baseEmbed');
const styles = require('../../config/styles.json');
class StationMainEmbed extends BaseEmbed {
    constructor(metroCore) {
        super(metroCore);
        this.styles = styles;
    }

    create(station, metroData) {
        if (!station) throw new Error('Station data is required');
        
        console.log(station) 
            
            
            
        
        // Normalize data
        const normalizedStation = this._normalizeStationData(station);
        const hex = this.styles.lineColors[normalizedStation.line.toLowerCase()]?.replace(/^#/, '') || '000000';
        const stationDyna = metroData?.stations?.[normalizedStation.code?.toLowerCase()] || { status: {} };
        const lineColor = parseInt(hex, 16);
        
        // Build station decoration
        let stationDeco = `${this.metro.config.linesEmojis[normalizedStation.line.toLowerCase()] || '🚇'}`;
        
        if (stationDyna.status?.code) {
            stationDeco += this.metro.config.stationIcons[parseInt(stationDyna.status.code)]?.emoji || 'ℹ️';
        }
        
        if (normalizedStation.ruta) {
            const rutaKey = normalizedStation.ruta.toLowerCase()
                .replace(/ /g, "")
                .replace("ruta", "")
                .replace("ú", "u");
            stationDeco += this.metro.config.stationIcons[rutaKey]?.emoji || '';
        }
        
        // Create base embed
        const embed = new EmbedBuilder()
            .setTitle(`${stationDeco} ${normalizedStation.displayName}`)
            .setColor(lineColor)
            .setImage(this._getPrimaryImage(normalizedStation))
            .addFields(
                { 
                    name: '📢 Estado', 
                    value: stationDyna.status?.appMessage || 'Sin información', 
                    inline: true 
                }
            );

        // Add services field if available
        if (normalizedStation.services) {
            let servicesText = normalizedStation.services
                .replace(/redbanc/gi, this.metro.config.services?.redbanc || 'Redbanc')
                .replace(/tel[ée]fonos/gi, this.metro.config.services?.telefono || 'Teléfonos')
                .replace(/Máquinas de carga autoservicio/gi, this.metro.config.services?.selfservice || 'Máquinas de carga');
            
            embed.addFields({
                name: '📖 Servicios',
                value: servicesText,
                inline: false
            });
        }

        // Add accessibility information
        this._addAccessibilityField(embed, normalizedStation);

        // Add commerce information
        if (normalizedStation.commerce) {
            embed.addFields({
                name: '🛍️ Comercio',
                value: this._processCommerceText(normalizedStation.commerce),
                inline: false
            });
        }

        // Add amenities information
        if (normalizedStation.amenities) {
            let amenitiesText = `👉 *${normalizedStation.amenities}*`;
            if (normalizedStation.amenities.toLowerCase().includes('bibliometro')) {
                amenitiesText = amenitiesText.replace(
                    /bibliometro/gi, 
                    this.metro.config.culture?.bibliometro || 'Bibliometro'
                );
            }
            
            embed.addFields({
                name: '🎭 Cultura',
                value: amenitiesText,
                inline: false
            });
        }

        // Add transfer information
        if (normalizedStation.transferLines?.length > 0) {
            embed.addFields({
                name: '🔄 Conecta con',
                value: normalizedStation.transferLines
                    .map(l => `${this.metro.config.linesEmojis[l.toLowerCase()] || `Línea ${l}`}`)
                    .join(', '),
                inline: true
            });
        }

        return embed;
    }

    _normalizeStationData(station) {
        return {
            ...station,
            transferLines: station.transferLines || (station.combination ? [station.combination] : []),
            accessibility: station.accessibility === 'None' ? null : station.accessibility,
            commerce: station.commerce === 'None' ? null : station.commerce,
            amenities: station.amenities === 'None' ? null : station.amenities
        };
    }

    _getPrimaryImage(station) {
        if (station.schematics?.[0]) {
            return station.schematics[0];
        }
        if (station.image) {
            return station.image;
        }
        return this._getLineImage(station.line);
    }

    _getLineImage(line) {
        return `https://www.metro.cl/images/lines/line-${line}.png`;
    }

    _addAccessibilityField(embed, station) {
        if (!station.accessibility) return;

        const processedLines = this._processAccessibilityText(station.accessibility);
        const fullText = processedLines.join('\n');
        
        const displayText = fullText.length > 300 
            ? `${fullText.substring(0, 300)}...` 
            : fullText;
        
        embed.addFields({
            name: `${this.metro.config.accessibility?.logo || '♿'} Accesibilidad`,
            value: displayText,
            inline: false
        });
        
        if (fullText.length > 300) {
            embed.addFields({
                name: '\u200B',
                value: `*Para ver la información completa de accesibilidad, haz clic en el botón ♿*`,
                inline: false
            });
        }
    }

    _processCommerceText(commerceText) {
        if (!commerceText) return 'No disponible';
        
        const commerceList = commerceText.split(',').map(item => item.trim());
        return commerceList.map(item => {
            if (this.metro.config.commerce?.[item]) {
                return this.metro.config.commerce[item];
            }
            
            const combinedMatch = Object.keys(this.metro.config.commerce || {}).find(name => 
                item.toLowerCase().includes(name.toLowerCase())
            );
            
            if (combinedMatch) {
                let result = item;
                Object.keys(this.metro.config.commerce).forEach(name => {
                    if (item.toLowerCase().includes(name.toLowerCase())) {
                        result = result.replace(new RegExp(name, 'gi'), this.metro.config.commerce[name]);
                    }
                });
                return result;
            }
            
            return `*${item}*`;
        }).join(', ');
    }

    _processAccessibilityText(accessibilityText) {
        if (!accessibilityText) return ["No hay información de accesibilidad"];
        
        const accessibilityLines = accessibilityText.split('\n');
        return accessibilityLines.map(line => {
            let processedLine = line;

            // Replace line references with emojis
            processedLine = processedLine.replace(/Línea (\d+[a-z]?)/gi, (match, lineNum) => {
                const lineKey = `l${lineNum.toLowerCase()}`;
                return this.metro.config.linesEmojis[lineKey] || match;
            });

            // Replace access letters with emojis (A, B, C, etc.)
            processedLine = processedLine.replace(/\(([a-z])\)/gi, (match, letter) => {
                const upperLetter = letter.toUpperCase();
                return String.fromCodePoint(0x1F170 + upperLetter.charCodeAt(0) - 65) + (upperLetter > 'A' ? '' : '️');
            });

            // Replace access labels with emojis
            processedLine = processedLine.replace(/Acceso ([A-Z])/gi, (match, letter) => {
                const emojiCode = 0x1F170 + letter.charCodeAt(0) - 65;
                return `Acceso ${String.fromCodePoint(emojiCode)}`;
            });
            
            // Normalize for comparison
            const lowerLine = processedLine.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            

            if (lowerLine.includes('todos los ascensores disponibles') || 
                lowerLine.match(/todos los ascensores (operativos|disponibles)/)) {
                return `${this.metro.config.accessibility?.estado?.ope || '✅'} ${processedLine}`;
            }
            
            
            // Add elevator icons
            if (lowerLine.includes('ascensor') || lowerLine.includes('ascensores')) {
                if (lowerLine.includes('fuera de servicio') || lowerLine.includes('no disponible')) {
                    return `${this.metro.config.accessibility?.estado?.fes || '⛔'} ${processedLine}`;
                }
                return `${this.metro.config.accessibility?.ascensor || '🛗'} ${processedLine}`;
            }
            
            // Add status icons
            
            // Add exit icons
            if (lowerLine.includes('salida de estación') || 
                lowerLine.includes('a nivel de vereda') || 
                lowerLine.includes('a nivel de calle')) {
                return `${this.metro.config.accessibility?.salida || '🚪'} ${processedLine}`;
            }
            
            return processedLine;
        });
    }
}

module.exports = StationMainEmbed;
