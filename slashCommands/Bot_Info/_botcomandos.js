const { EmbedBuilder } = require('discord.js');
const ComandoButton = require('../../modules/interactions/buttons/ComandoButton');

module.exports = {
    parentCommand: 'bot',
    data: (subcommand) => subcommand
        .setName('comandos')
        .setDescription('Muestra todos los comandos disponibles')
        .addStringOption(option =>
            option.setName('buscar')
                .setDescription('Buscar comando específico')
                .setAutocomplete(true)),

    async execute(interaction) {
        const searchTerm = interaction.options.getString('buscar');
        const comandoButton = new ComandoButton();

        try {
            if (searchTerm) {
                const results = this._searchCommands(interaction.client, searchTerm);
                if (results.length === 0) {
                    return interaction.reply({
                        content: '🔍 No se encontraron comandos',
                        ephemeral: true
                    });
                }
                return interaction.reply(await comandoButton.buildSearchView(results, searchTerm));
            }

            // Show default category view
            interaction.reply(await comandoButton.buildCategoryView(interaction.client));
        } catch (error) {
            console.error('Error in comandos command:', error);
            return interaction.reply({
                content: '❌ Error al mostrar los comandos',
                ephemeral: true
            });
        }
    },

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused().toLowerCase();
        const commands = this._getAllCommands(interaction.client);

        const filtered = commands
            .filter(cmd => 
                cmd.name.toLowerCase().includes(focusedValue) ||
                cmd.description.toLowerCase().includes(focusedValue))
            .slice(0, 25);

        await interaction.respond(
            filtered.map(cmd => ({
                name: `/${cmd.name} - ${cmd.description}`,
                value: cmd.name
            }))
        );
    },

    // Helper methods
    _getAllCommands(client) {
        const commands = [];
        client.commands.forEach(cmd => {
            commands.push({
                name: cmd.data.name,
                description: cmd.data.description,
                category: cmd.category
            });

            if (cmd.subcommands) {
                cmd.subcommands.forEach(subCmd => {
                    commands.push({
                        name: `${cmd.data.name} ${subCmd.data.name}`,
                        description: subCmd.data.description,
                        category: subCmd.category || cmd.category
                    });
                });
            }
        });
        return commands;
    },

    _searchCommands(client, term) {
        const allCommands = this._getAllCommands(client);
        return allCommands.filter(cmd => 
            cmd.name.toLowerCase().includes(term.toLowerCase()) || 
            cmd.description.toLowerCase().includes(term.toLowerCase())
        );
    }
};