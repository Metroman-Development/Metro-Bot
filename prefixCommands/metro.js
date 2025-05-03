const { MetroCore } = require('../modules/metro/core/MetroCore');
const { EmbedBuilder } = require('discord.js');
const SearchCore = require('../modules/metro/search/SearchCore');

class MetroSystem {
  constructor() {
    this.metro = null;
    this.search = new SearchCore('station', {
      similarityThreshold: 0.8,
      phoneticWeight: 0.6
    });
  }

  async initialize() {
    if (!this.metro) {
      this.metro = await MetroCore.getInstance();
    }
    return this.metro;
  }

  // Test cases for verification
  async verifyCriticalStations() {
    const testStations = [
      { name: "Plaza Egaña", expectedLine: "l4" },
      { name: "Macul", expectedLine: "l4" },
      { name: "Ñuble", expectedLine: "l5" },
      { name: "Maipú", expectedLine: "l5" }
    ];

    const results = [];
    for (const test of testStations) {
      try {
        const matches = await this.search.search(test.name);
        const bestMatch = matches[0];
        
        if (!bestMatch || bestMatch.line !== test.expectedLine) {
          results.push({
            name: test.name,
            status: 'error',
            error: bestMatch ? 
              `Found on wrong line (${bestMatch.line.toUpperCase()} instead of ${test.expectedLine.toUpperCase()})` : 
              'Station not found'
          });
        } else {
          results.push({
            name: test.name,
            status: 'success',
            line: bestMatch.line.toUpperCase(),
            stationId: bestMatch.id
          });
        }
      } catch (error) {
        results.push({
          name: test.name,
          status: 'error',
          error: error.message
        });
      }
    }
    return results;
  }

  async verifyLines() {
    const lines = ['l4', 'l5'];
    const results = [];
    
    for (const lineId of lines) {
      try {
        const line = this.metro.lines.get(lineId);
        if (!line) {
          throw new Error('Line not found');
        }
        
        results.push({
          line: lineId.toUpperCase(),
          status: 'success',
          stationCount: line.stations.length,
          operational: line.status === 'operational'
        });
      } catch (error) {
        results.push({
          line: lineId.toUpperCase(),
          status: 'error',
          error: error.message
        });
      }
    }
    return results;
  }

  async getSystemStatus() {
    const lines = this.metro.lines.getAll();
    return {
      totalLines: lines.length,
      operationalLines: lines.filter(l => l.status === 'operational').length,
      totalStations: Object.keys(this.metro.stations.getAll()).length
    };
  }

  // Report generators
  generateStationReport(results) {
    const success = results.filter(r => r.status === 'success');
    const errors = results.filter(r => r.status === 'error');

    const embed = new EmbedBuilder()
      .setTitle('🚉 Reporte de Estaciones Críticas')
      .setColor(0x3498db)
      .addFields(
        {
          name: '✅ Estaciones Operativas',
          value: success.map(s => `${s.name} (Línea ${s.line})`).join('\n') || 'Ninguna',
          inline: true
        },
        {
          name: '❌ Estaciones con Problemas',
          value: errors.map(e => `${e.name}: ${e.error}`).join('\n') || 'Ninguna',
          inline: true
        }
      );

    return embed;
  }

  generateLineReport(results) {
    const embed = new EmbedBuilder()
      .setTitle('🛤️ Reporte de Líneas')
      .setColor(0xe67e22);

    results.forEach(line => {
      if (line.status === 'success') {
        embed.addFields({
          name: `Línea ${line.line}`,
          value: `Estaciones: ${line.stationCount}\nEstado: ${line.operational ? '🟢 Operativa' : '🔴 Interrumpida'}`,
          inline: true
        });
      } else {
        embed.addFields({
          name: `Línea ${line.line}`,
          value: `Error: ${line.error}`,
          inline: true
        });
      }
    });

    return embed;
  }

  generateStatusReport(status) {
    return new EmbedBuilder()
      .setTitle('📡 Estado General del Sistema')
      .setColor(0x2ecc71)
      .addFields(
        {
          name: 'Líneas',
          value: `${status.operationalLines}/${status.totalLines} operativas`,
          inline: true
        },
        {
          name: 'Estaciones',
          value: `${status.totalStations} en total`,
          inline: true
        }
      );
  }

  // Command handlers
  async handleStationCommand(args) {
    if (!args || args.length === 0) {
      return new EmbedBuilder()
        .setTitle('❌ Error')
        .setDescription('Debes especificar un nombre de estación')
        .setColor(0xe74c3c);
    }

    const query = args.join(' ');
    const matches = await this.search.search(query);

    if (matches.length === 0) {
      return new EmbedBuilder()
        .setTitle('🔍 Estación no encontrada')
        .setDescription(`No se encontraron resultados para "${query}"`)
        .setColor(0xe74c3c);
    }

    const embed = new EmbedBuilder()
      .setTitle(`🚉 Información de ${matches[0].name}`)
      .setColor(0x3498db);

    matches.slice(0, 3).forEach((match, i) => {
      const station = this.metro.stations.get(match.id);
      embed.addFields({
        name: i === 0 ? 'Mejor coincidencia' : `Alternativa ${i}`,
        value: [
          `Línea: ${match.line.toUpperCase()}`,
          `Estado: ${station?.status || 'desconocido'}`,
          `ID: ${match.id}`,
          `Puntuación: ${match.score.toFixed(2)}`
        ].join('\n'),
        inline: i < 2
      });
    });

    return embed;
  }

  async handleLineCommand(args) {
    if (!args || args.length === 0) {
      return new EmbedBuilder()
        .setTitle('❌ Error')
        .setDescription('Debes especificar una línea (ej: L4, L5)')
        .setColor(0xe74c3c);
    }

    const lineId = args[0].toLowerCase();
    const line = this.metro.lines.get(lineId);

    if (!line) {
      return new EmbedBuilder()
        .setTitle('❌ Línea no encontrada')
        .setDescription(`No existe la línea ${lineId.toUpperCase()}`)
        .setColor(0xe74c3c);
    }

    const stations = line.stations.slice(0, 10).map(s => {
      const station = this.metro.stations.get(s);
      return `${station?.name || s} (${station?.status || '?'})`;
    });

    const embed = new EmbedBuilder()
      .setTitle(`🛤️ Línea ${line.id.toUpperCase()}`)
      .setColor(parseInt(line.color.replace('#', '0x')))
      .addFields(
        {
          name: 'Información',
          value: [
            `Estado: ${line.status === 'operational' ? '🟢 Operativa' : '🔴 Interrumpida'}`,
            `Estaciones: ${line.stations.length}`,
            `Color: ${line.color}`
          ].join('\n'),
          inline: true
        },
        {
          name: 'Primeras estaciones',
          value: stations.join('\n'),
          inline: true
        }
      );

    if (line.stations.length > 10) {
      embed.setFooter({ text: `Mostrando 10 de ${line.stations.length} estaciones` });
    }

    return embed;
  }
}

// Command export
module.exports = {
  name: 'metro',
  description: 'Sistema de información y reportes del metro',
  subcommands: {
    all: {
      description: 'Reporte completo del sistema',
      async execute(message) {
        const system = new MetroSystem();
        await system.initialize();

        const [stations, lines, status] = await Promise.all([
          system.verifyCriticalStations(),
          system.verifyLines(),
          system.getSystemStatus()
        ]);

        await message.channel.send({
          embeds: [
            system.generateStatusReport(status),
            system.generateLineReport(lines),
            system.generateStationReport(stations)
          ]
        });
      }
    },
    station: {
      description: 'Buscar información de estación',
      usage: '<nombre>',
      async execute(message, args) {
        const system = new MetroSystem();
        await system.initialize();
        const embed = await system.handleStationCommand(args);
        await message.channel.send({ embeds: [embed] });
      }
    },
    line: {
      description: 'Información de línea',
      usage: '<línea>',
      async execute(message, args) {
        const system = new MetroSystem();
        await system.initialize();
        const embed = await system.handleLineCommand(args);
        await message.channel.send({ embeds: [embed] });
      }
    },
    status: {
      description: 'Estado operacional del sistema',
      async execute(message) {
        const system = new MetroSystem();
        await system.initialize();
        const status = await system.getSystemStatus();
        const embed = system.generateStatusReport(status);
        await message.channel.send({ embeds: [embed] });
      }
    }
  },
  async execute(message, args) {
    if (!args || args.length === 0) {
      return message.channel.send([
        '**Sistema de Información Metro**',
        'Subcomandos disponibles:',
        '`!metro all` - Reporte completo del sistema',
        '`!metro station <nombre>` - Buscar estación',
        '`!metro line <línea>` - Información de línea',
        '`!metro status` - Estado operacional'
      ].join('\n'));
    }

    const subcommand = args[0].toLowerCase();
    const remainingArgs = args.slice(1);

    if (subcommand === 'all') {
      return this.subcommands.all.execute(message);
    } else if (subcommand === 'station') {
      return this.subcommands.station.execute(message, remainingArgs);
    } else if (subcommand === 'line') {
      return this.subcommands.line.execute(message, remainingArgs);
    } else if (subcommand === 'status') {
      return this.subcommands.status.execute(message);
    }

    return message.channel.send('Subcomando no reconocido. Usa `!metro` para ver opciones.');
  }
};