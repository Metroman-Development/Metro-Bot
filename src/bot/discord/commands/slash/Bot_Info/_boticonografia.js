const { SlashCommandSubcommandBuilder, EmbedBuilder } = require('discord.js');
const metroConfig = require('../../../../../config/metro/metroConfig');

module.exports = {
    data: new SlashCommandSubcommandBuilder()
        .setName('iconografia')
        .setDescription('Muestra una leyenda de los iconos y emojis utilizados por el bot.')
        .addStringOption(option =>
            option.setName('grupo')
                .setDescription('Selecciona un grupo específico de iconos para ver.')
                .addChoices(
                    { name: 'Estados de Red', value: 'network' },
                    { name: 'Estados de Estación', value: 'stations' },
                    { name: 'Conexiones de Transporte', value: 'transport' },
                    { name: 'Conexiones de Bicicletas', value: 'bikes' },
                    { name: 'Tarjetas de Acceso', value: 'cards' },
                    { name: 'Niveles de Severidad', value: 'severity' },
                    { name: 'Mostrar Todo', value: 'all' }
                )
                .setRequired(false)
        ),

    async execute(interaction) {
        const group = interaction.options.getString('grupo') || 'all';

        const embed = new EmbedBuilder()
            .setTitle('🚇 Leyenda de Iconografía del Sistema')
            .setColor(0x0099FF)
            .setFooter({ text: `Solicitado por ${interaction.user.username}` });

        const description = this.generateLegendForGroup(group);
        embed.setDescription(description);

        await interaction.reply({ embeds: [embed] });
    },

    generateLegendForGroup(group) {
        switch (group) {
            case 'network': return this.generateNetworkLegend();
            case 'stations': return this.generateStationsLegend();
            case 'transport': return this.generateTransportLegend();
            case 'bikes': return this.generateBikesLegend();
            case 'cards': return this.generateCardsLegend();
            case 'severity': return this.generateSeverityLegend();
            default: return this.generateFullLegend();
        }
    },

    generateNetworkLegend() {
        const lineStatuses = Object.values(metroConfig.statusTypes).filter(s => s.name.includes('Línea') || ['operativa', 'lenta', 'retrasos', 'parcial', 'suspendida'].includes(s.name));
        const legend = lineStatuses.map(s => `${s.emoji} = ${s.description}`);
        return [
            '**🚇 Estados de Red (Líneas):**',
            ...legend
        ].join('\n');
    },

    generateStationsLegend() {
        const stationStatuses = Object.values(metroConfig.statusTypes).filter(s => !s.name.includes('Línea') && !['operativa', 'lenta', 'retrasos', 'parcial', 'suspendida'].includes(s.name));
        const legend = stationStatuses.map(s => `${s.emoji} = ${s.description}`);
        return [
            '**🚉 Estados de Estación:**',
            ...legend
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