// _boticonografia.js
// _boticonografia.js
const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const metroConfig = require('../../config/metro/metroConfig');

module.exports = {
    parentCommand: 'bot',
    data: (subcommand) => subcommand
        .setName('iconografia')
        .setDescription('Muestra los iconos y emojis del sistema')
        .addStringOption(option => 
            option.setName('grupo')
                .setDescription('Selecciona un grupo específico de iconos')
                .addChoices(
                    { name: 'Estados de Red', value: 'network' },
                    { name: 'Estados de Estación', value: 'stations' },
                    { name: 'Conexiones de Transporte', value: 'transport' },
                    { name: 'Conexiones de Bicicletas', value: 'bikes' },
                    { name: 'Tarjetas de Acceso', value: 'cards' },
                    { name: 'Niveles de Severidad', value: 'severity' },
                    { name: 'Todos (completo)', value: 'all' }
                )
                .setRequired(false)
        ),

    async execute(interaction) {
        const group = interaction.options.getString('grupo') || 'all';
        
        // Create the embed
        const embed = new EmbedBuilder()
            .setTitle('🚇 Iconografía del Sistema Metro')
            .setColor(0x0099FF)
            .setFooter({ text: `Solicitado por ${interaction.user.username}` });

        // Generate content based on selected group
        switch(group) {
            case 'network':
                embed.setDescription(this.generateNetworkLegend());
                break;
            case 'stations':
                embed.setDescription(this.generateStationsLegend());
                break;
            case 'transport':
                embed.setDescription(this.generateTransportLegend());
                break;
            case 'bikes':
                embed.setDescription(this.generateBikesLegend());
                break;
            case 'cards':
                embed.setDescription(this.generateCardsLegend());
                break;
            case 'severity':
                embed.setDescription(this.generateSeverityLegend());
                break;
            default:
                embed.setDescription(this.generateFullLegend());
        }

        await interaction.reply({ embeds: [embed] });
    },

    // Individual legend generators
    generateNetworkLegend() {
        return [
            '**🚇 Estados de Red:**',
            `${metroConfig.NETWORK_STATUS_MAP[1].emoji} = ${metroConfig.NETWORK_STATUS_MAP[1].message}`,
            `${metroConfig.NETWORK_STATUS_MAP[0].emoji} = ${metroConfig.NETWORK_STATUS_MAP[0].message}`,
            `${metroConfig.NETWORK_STATUS_MAP[3].emoji} = ${metroConfig.NETWORK_STATUS_MAP[3].message}`,
            `${metroConfig.NETWORK_STATUS_MAP[2].emoji} = ${metroConfig.NETWORK_STATUS_MAP[2].message}`,
            `${metroConfig.NETWORK_STATUS_MAP[4].emoji} = ${metroConfig.NETWORK_STATUS_MAP[4].message}`,
            `${metroConfig.NETWORK_STATUS_MAP[5].emoji} = ${metroConfig.NETWORK_STATUS_MAP[5].message}`
        ].join('\n');
    },

    generateStationsLegend() {
        return [
            '**🚉 Estados de Estación:**',
            '*(Estación Simple)*',
            `${metroConfig.stationIcons[1].emoji} = ${metroConfig.stationIcons[1].message}`,
            `${metroConfig.stationIcons[2].emoji} = ${metroConfig.stationIcons[2].message}`,
            `${metroConfig.stationIcons[3].emoji} = ${metroConfig.stationIcons[3].message}`,
            `${metroConfig.stationIcons[4].emoji} = ${metroConfig.stationIcons[4].message}`,
            `${metroConfig.stationIcons[5].emoji} = ${metroConfig.stationIcons[5].message}`,
            `${metroConfig.stationIcons[0].emoji} = ${metroConfig.stationIcons[0].message}`,
            '',
            '*(Estación de Combinación)*',
            `${metroConfig.combIcons[1].emoji} = ${metroConfig.combIcons[1].message}`,
            `${metroConfig.combIcons[2].emoji} = ${metroConfig.combIcons[2].message}`,
            `${metroConfig.combIcons[3].emoji} = ${metroConfig.combIcons[3].message}`,
            `${metroConfig.combIcons[5].emoji} = ${metroConfig.combIcons[5].message}`,
            `${metroConfig.combIcons[0].emoji} = ${metroConfig.combIcons[0].message}`
        ].join('\n');
    },

    generateTransportLegend() {
        return [
            '**🚍 Conexiones de Transporte:**',
            `${metroConfig.connectionEmojis['Centropuerto']} = Centropuerto`,
            `${metroConfig.connectionEmojis['EFE']} = EFE`,
            `${metroConfig.connectionEmojis['EIM']} = EIM`,
            `${metroConfig.connectionEmojis['Terminal de Buses']} = Terminal de Buses`
        ].join('\n');
    },

    generateBikesLegend() {
        return [
            '**🚲 Conexiones de Bicicletas:**',
            `${metroConfig.connectionEmojis['Línea Cero']} = Línea Cero`,
            `${metroConfig.connectionEmojis['BiciMetro']} = BiciMetro`,
            `${metroConfig.connectionEmojis['U Invertida']} = U Invertida`
        ].join('\n');
    },

    generateCardsLegend() {
        return [
            '**🎫 Tarjetas de Acceso:**',
            `${metroConfig.accessCards.bip} = Tarjeta BIP!`,
            `${metroConfig.accessCards.tne} = TNE`,
            `${metroConfig.accessCards.bipAdultoMayor} = BIP Adulto Mayor`,
            `${metroConfig.accessCards.tarjetaAdultoMayor} = Tarjeta Adulto Mayor`
        ].join('\n');
    },

    generateSeverityLegend() {
        return [
            '**🛑 Niveles de Severidad:**',
            '💀 = Crítica (300+)',
            '🔥 = Muy Alta (200-299)',
            '⚠️ = Alta (150-199)',
            '🔶 = Moderada (100-149)',
            '🔸 = Baja (50-99)',
            '✅ = Normal (0-49)'
        ].join('\n');
    },

    generateFullLegend() {
        return [
            this.generateNetworkLegend(),
            '',
            this.generateStationsLegend(),
            '',
            this.generateTransportLegend(),
            '',
            this.generateBikesLegend(),
            '',
            this.generateCardsLegend(),
            '',
            this.generateSeverityLegend()
        ].join('\n');
    }
};