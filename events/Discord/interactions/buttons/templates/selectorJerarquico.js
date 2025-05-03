module.exports = {
    customId: 'opt_', // opt_[tipo-comando]_[nivel]_[id-padre]
    
    async execute(interaction, client) {
        const [_, commandType, level, parentId] = interaction.customId.split('_');
        
        // 1. Obtener opciones basadas en contexto
        const options = await fetchOptions({
            commandType,
            level: parseInt(level),
            parentId
        });

        // 2. Generar botones dinámicos
        const rows = this._buildOptionRows(options, commandType);

        // 3. Responder
        await interaction.update({
            content: `Opciones para ${commandType}:`,
            components: rows
        });
    },

    _buildOptionRows(options, context) {
        return options.chunk(5).map((group, i) => {
            return new ActionRowBuilder().addComponents(
                group.map(opt => (
                    new ButtonBuilder()
                        .setCustomId(`opt_${context}_${opt.level}_${opt.id}`)
                        .setLabel(opt.name)
                        .setStyle(this._getStyleByLevel(opt.level))
                ))
            );
        });
    },

    _getStyleByLevel(level) {
        const styles = [
            ButtonStyle.Primary,
            ButtonStyle.Secondary,
            ButtonStyle.Success
        ];
        return styles[level % styles.length];
    }
};