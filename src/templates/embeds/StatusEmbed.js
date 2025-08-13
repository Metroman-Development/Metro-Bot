// templates/embeds/StatusEmbed.js
const BaseEmbed = require('./baseEmbed');
const config = require('../../config/metro/metroConfig') 
// templates/embeds/StatusEmbed.js

const stationGrouper = require('../utils/stationGrouper');

// templates/embeds/StatusEmbed.js


class StatusEmbed extends BaseEmbed {
    constructor(metroCore) {
        super(metroCore);
    }

 
    

    static _getStatusText(statusCode) {
        const statusMap = {
            '1': 'Operativa',
            '2': 'Parcial',
            '3': 'Cerrada',
            'default': 'Desconocido'
        };
        return statusMap[statusCode] || statusMap.default;
    }

    static _getStatusColor(statusCode) {
        const colorMap = {
            '1': 0x00AA00, // Green
            '2': 0xFFAA00, // Yellow
            '3': 0xAA0000, // Red
            'default': 0xAAAAAA // Gray
        };
        return colorMap[statusCode] || colorMap.default;
    }

    static _buildConnectionFields(connections) {
        if (!connections || connections.length === 0) return [];
        
        return connections.map(conn => ({
            name: `🔗 Conexión con Línea ${conn.id}`,
            value: `Estado: ${this._getStatusEmoji(conn.status)} ${this._getStatusText(conn.status)}`,
            inline: true
        }));
    }

    
         

    static _getStatusEmoji(statusCode) {

        const emojiMap = {

            '1': '🟢',

            '2': '🟡',

            '3': '🔴',

            'default': '⚪'

        };

        return emojiMap[statusCode] || emojiMap.default;

    }

     

    static createStationStatus(metro, station) {
        const statusCode = station.status?.code || 'default';
        const statusStyle = config.statusMapping[parseInt(statusCode)];
        const statusText = statusStyle.message;
        
        const statusEmoji = statusStyle.emoji
        
        let transferInfo = "" ;
        
        if (station.transferLines.length>0){

            const cleanStationName = station.name.replace(/\s*L\d+[A-Z]?\s*/i, '');
            const stationsLol = Object.values(metro.api.getProcessedData().stations)
            
            console.log(stationsLol) 
            
            const transferStation = stationsLol.find(s=>s.displayName === `${cleanStationName} ${station.line.toUpperCase()}`);
                                                     
               const isTransferAvailable = 
  station.status.code !== '2' && 
  station.status.code !== '3' && 
  transferStation.status.code !== '2' && 
  transferStation.status.code !== '3';
            
            transferInfo =  isTransferAvailable ? "\n✅ Combinación Disponible" : "\n❌ Combinación No Disponible, prefiera alternativas"

                

               }
        
        
        const stationInfo = (station.status?.appMessage || 'Estado No Disponible') + "\n" + "📢 Info Extra: " + (station.status.message!==""? station.status.message : "") +  transferInfo 
        
        return {
            embed: {
                title: `${config.linesEmojis[station.line]} Estación ${station.name || 'Desconocida'}`,
                description: 
                
              
                            `**### 👀 Estado:** ${statusEmoji} ${statusText}`,
                color: this._getStatusColor(statusCode),
                fields: [
                    {
                        name: '📌Información',
                        value: stationInfo,
                        inline: false
                    },
                    ...this._buildConnectionFields(metro._combinedData.connections), 
                    
                   
          
                
                    
                ],
                footer: { 
                    text: `Última actualización: ${station.lastUpdated || 'Desconocida'}` 
                }
            }
        };
    }

    
    createNetworkStatus(networkStatus, lineStatuses) {
        const mainStatus = this.statusConfig[networkStatus.code];
        
        return {
            embed: this.createEmbed({
                title: `🚇 Estado de la Red: ${mainStatus.emoji} ${mainStatus.name}`,
                description: this._buildNetworkDescription(networkStatus),
                color: mainStatus.color,
                fields: this._buildLineFields(lineStatuses),
                footer: { 
                    text: `Actualizado: ${new Date(networkStatus.timestamp).toLocaleString('es-CL')}` 
                }
            }),
            components: [this._createRefreshRow()]
        };
    }

    static createLineStatus(metro, line) {
    const metroData = metro.api.getProcessedData();
    const allStations = metroData.stations;
    
    // Convert hex color to numerical
    const lineColor = typeof line.color === 'string' && line.color.startsWith('#') 
        ? parseInt(line.color.slice(1), 16) 
        : line.color || 0x7289DA;

    // Group problematic stations
    const problematicGroups = stationGrouper.groupStationsByStatus(
        line.stations,
        allStations,
        station => ["2", "3", "4"].includes(station.status?.code)
    );
    
    // Group normal stations
    const normalGroups = stationGrouper.groupStationsByStatus(
        line.stations,
        allStations,
        station => station.status?.code === "1"
    );
    
    // Build status summary sections
    const sections = [];
    
    // 1. General line status
    sections.push(`**📢 Estado general:** \`${line.status.appMessage || 'Operación normal'}\``);
    if (line.status.message) {
        sections.push(`**Detalles:** ${line.status.message}`);
    }
    
    // 2. Problematic stations
    if (problematicGroups.length > 0) {
        let problemSection = '### 🚧 Estaciones con problemas\n';
        problematicGroups.forEach(group => {
            const statusInfo = config.statusMapping[group.statusCode];
            problemSection += `\n${statusInfo.emoji} **${group.count} estación${group.count > 1 ? 'es' : ''}:** `;
            problemSection += `${group.firstStation.displayName} → ${group.lastStation.displayName}`;
            problemSection += `\n↳ ${statusInfo.message}\n`;
        });
        sections.push(problemSection);
    } 
    
    // 3. Normal stations
    if (normalGroups.length > 0) {
        let normalSection = problematicGroups.length === 0 ? '### 🎉✨ Toda la Línea Operativa\n' : '## ✅ Estaciones operativas\n';
        normalGroups.forEach(group => {
            normalSection += `\n🟢 **${group.count} estacion${group.count > 1 ? 'es' : ''}:** `;
            normalSection += `**${group.firstStation.displayName}** → **${group.lastStation.displayName}**`;
        });
        sections.push(normalSection);
    }
    
    // 4. Transfer stations
    const transferStations = line.stations
        .map(id => allStations[id])
        .filter(station => station?.transferLines?.length > 0);
    
    if (transferStations.length > 0) {
        let transferSection = '## 🔄 Estaciones de combinación\n'; 
        
        transferStations.forEach(station => {
            const baseName = station.displayName.replace(/\s(l\d+[a-z]?)$/i, '').trim();
    
            
            transferSection += `\n ### ${config.combIcons[station.status.code].emoji}**__${baseName}__** *${station.status.appMessage}*`;
         
            station.transferLines.forEach((transferLineId, index) => {
    // Get the clean station name without line suffix
    
    // Create the display name with the current transfer line
    const lineSuffix = transferLineId.toUpperCase(); // or keep original case
    const transferDisplayName = `${baseName} ${lineSuffix}`;
    
    // Find the corresponding station
    const sideStation = Object.values(allStations).find(
        s => s.displayName === transferDisplayName 
    );

    if (sideStation) {
        const statusInfo = config.statusMapping[sideStation.status?.code] || 
                          config.statusMapping["1"];
        
        // Only show the full station name for the first transfer line
    //    if (index === 0) {
      //      transferSection += `\n${config.combIcons[station.status.code].emoji}**__${transferDisplayName}__**`;
   //     }
        
        transferSection += `\n-# ↳ ${statusInfo.emoji}`;
        
        transferSection += ` Combinación Línea ${config.linesEmojis[transferLineId] || '🚇'}`;
        

        transferSection += ` *${statusInfo.message}*`
        
    }
});
            
        });
        sections.push(transferSection);
    }
    
    return {
        embed: {
            title: `${config.linesEmojis[line.id] || '🚇'} ${line.displayName}`,
            description: sections.join('\n\n'),
            color: lineColor,
            timestamp: new Date().toISOString(),
            footer: {
                text: 'Actualizado',
                icon_url: config.metroLogo.principal
            }
        }
    };
}
          //  components: [this._createBackRow()]
       
   

    // Private Helpers
    _buildNetworkDescription(status) {
        let desc = `📅 **Horario:** ${status.schedule}\n`;
        desc += status.issues ? `⚠️ **Incidencias:** ${status.issues}` : '✅ Operación normal';
        return desc;
    }

    _buildLineFields(lines) {
        return lines.map(line => {
            const status = this.statusConfig[line.code];
            return {
                name: `${status.emoji} Línea ${line.number}`,
                value: `• **Estado:** ${status.name}\n` +
                       `• **Detalles:** ${line.message || 'Operación normal'}`,
                inline: true
            };
        });
    }

    _buildStationFields(stations) {
        return stations.map(station => ({
            name: `🚉 ${station.name}`,
            value: `• Estado: ${this.getStatusEmoji(station.code)} ${station.status}\n` +
                   `• Mensaje: ${station.message || 'Normal'}`,
            inline: false
        }));
    }

    _createRefreshRow() {
        return this.createActionRow([
            this.createButton(
                'status_refresh',
                '🔄 Actualizar',
                ButtonStyle.Secondary
            )
        ]);
    }

    _createBackRow() {
        return this.createActionRow([
            this.createButton(
                'status_back',
                '↩️ Volver',
                ButtonStyle.Primary
            )
        ]);
    }
}

module.exports = StatusEmbed;