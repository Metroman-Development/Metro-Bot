const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const metroConfig = require('../../../../../config/metro/metroConfig');

/**
 * @file Subcommand for the 'bot' command, displaying system iconography.
 * @description This subcommand provides a legend for the various icons and emojis used throughout the bot to represent different statuses and features.
 */
module.exports = {
    parentCommand: 'bot',
    data: (subcommand) => subcommand
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

    /**
     * Executes the 'iconografia' subcommand.
     * @param {import('discord.js').Interaction} interaction The interaction object.
     */
    async execute(interaction) {
        const group = interaction.options.getString('grupo') || 'all';
        
        const embed = new EmbedBuilder()
            .setTitle('🚇 Leyenda de Iconografía del Sistema')
            .setColor(0x0099FF)
            .setFooter({ text: `Solicitado por ${interaction.user.username}` });

        // Generate the description based on the selected group
        const description = this.generateLegendForGroup(group);
        embed.setDescription(description);

        await interaction.reply({ embeds: [embed] });
    },

    /**
     * Generates the legend description for a specific group.
     * @param {string} group The selected icon group.
     * @returns {string} The formatted legend description.
     */
    generateLegendForGroup(group) {
        switch(group) {
            case 'network': return this.generateNetworkLegend();
            case 'stations': return this.generateStationsLegend();
            case 'transport': return this.generateTransportLegend();
            case 'bikes': return this.generateBikesLegend();
            case 'cards': return this.generateCardsLegend();
            case 'severity': return this.generateSeverityLegend();
            default: return this.generateFullLegend();
        }
    },

    /**
     * Generates the legend for network status icons.
     * @returns {string} The formatted legend.
     */
    generateNetworkLegend() {
        const lineStatuses = Object.values(metroConfig.statusTypes).filter(s => s.name.includes('Línea') || ['operativa', 'lenta', 'retrasos', 'parcial', 'suspendida'].includes(s.name));
        const legend = lineStatuses.map(s => `${s.emoji} = ${s.description}`);
        return [
            '**🚇 Estados de Red (Líneas):**',
            ...legend
        ].join('\n');
    },

    /**
     * Generates the legend for station status icons.
     * @returns {string} The formatted legend.
     */
    generateStationsLegend() {
        const stationStatuses = Object.values(metroConfig.statusTypes).filter(s => !s.name.includes('Línea') && !['operativa', 'lenta', 'retrasos', 'parcial', 'suspendida'].includes(s.name));
        const legend = stationStatuses.map(s => `${s.emoji} = ${s.description}`);
        return [
            '**🚉 Estados de Estación:**',
            ...legend
        ].join('\n');
    },

    /**
     * Generates the legend for transport connection icons.
     * @returns {string} The formatted legend.
     */
    generateTransportLegend() {
        return [
            '**🚍 Conexiones de Transporte:**',
            `${metroConfig.connectionEmojis['Centropuerto']} = Centropuerto`,
            `${metroConfig.connectionEmojis['EFE']} = EFE`,
            `${metro.connectionEmojis['EIM']} = EIM`,
            `${metroConfig.connectionEmojis['Terminal de Buses']} = Terminal de Buses`
        ].join('\n');
    },

    /**
     * Generates the legend for bicycle connection icons.
     * @returns {string} The formatted legend.
     */
    generateBikesLegend() {
        return [
            '**🚲 Conexiones de Bicicletas:**',
            `${metroConfig.connectionEmojis['Línea Cero']} = Línea Cero`,
            `${metroConfig.connectionEmojis['BiciMetro']} = BiciMetro`,
            `${metroConfig.connectionEmojis['U Invertida']} = U Invertida`
        ].join('\n');
    },

    /**
     * Generates the legend for access card icons.
     * @returns {string} The formatted legend.
     */
    generateCardsLegend() {
        return [
            '**🎫 Tarjetas de Acceso:**',
            `${metroConfig.accessCards.bip} = Tarjeta BIP!`,
            `${metroConfig.accessCards.tne} = TNE`,
            `${metroConfig.accessCards.bipAdultoMayor} = BIP Adulto Mayor`,
            `${metroConfig.accessCards.tarjetaAdultoMayor} = Tarjeta Adulto Mayor`
        ].join('\n');
    },

    /**
     * Generates the legend for severity level icons.
     * @returns {string} The formatted legend.
     */
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

    /**
     * Generates a complete legend with all icon groups.
     * @returns {string} The formatted full legend.
     */
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