
const { createEmbed } = require('../../../../utils/embeds');

const { getUnresolvedBugs, getAllBugs, getBugById, resolveBug } = require('../../../../utils/bugTracker');

const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const BUGS_PER_PAGE = 3; // Number of bugs to display per page

module.exports = {

    name: 'bug',

    description: 'Verifica y visualiza errores reportados.',

    usage: '!bug <subcomando> [id]',

    subcommands: {

        view: {

            description: 'Ver un error específico por su ID.',

            usage: '!bug view <id>'

        },

        pending: {

            description: 'Ver todos los errores pendientes (no resueltos).',

            usage: '!bug pending [página]'

        },

        all: {

            description: 'Ver todos los errores reportados.',

            usage: '!bug all [página]'

        },

        count: {

            description: 'Ver la cantidad de errores según su estado (pendiente o resuelto).',

            usage: '!bug count [estado]'

        },

        resolve: {

            description: 'Marcar un error como resuelto.',

            usage: '!bug resolve <id>'

        }

    },

    async execute(message, args) {

        const [subcommand, ...subArgs] = args;

        switch (subcommand) {

            case 'view':

                await this.handleViewBug(message, subArgs);

                break;

            case 'pending':

                await this.handlePendingBugs(message, subArgs);

                break;

            case 'all':

                await this.handleAllBugs(message, subArgs);

                break;

            case 'count':

                await this.handleBugCount(message, subArgs);

                break;

            case 'resolve':

                await this.handleResolveBug(message, subArgs);

                break;

            default:

                message.reply('❌ Subcomando no válido. Usa `!bug view <id>`, `!bug pending`, `!bug all`, `!bug count` o `!bug resolve <id>`.');

        }

    },

    /**

     * Handle viewing a specific bug by ID.

     */

    async handleViewBug(message, args) {

        if (args.length < 1) {

            return message.reply('❌ Uso correcto: `!bug view <id>`');

        }

        const bugId = args[0];

        try {

            const bug = await getBugById(bugId);

            if (!bug) {

                return message.reply('❌ No se encontró ningún error con ese ID.');

            }

            const embed = createEmbed(

                `**Título:** ${bug.title}\n` +

                `**Descripción:** ${bug.description}\n` +

                `**Reportado por:** ${bug.reported_by}\n` +

                `**Fecha:** ${bug.reported_at}\n` +

                `**Resuelto:** ${bug.resolved ? '✅' : '❌'}`,

                bug.resolved ? 'success' : 'error',

                `🐛 Error: ${bug.bug_id}`

            );

            await message.reply({ embeds: [embed] });

        } catch (error) {

            console.error('Error al obtener el error:', error);

            message.reply('❌ Ocurrió un error al obtener el error.');

        }

    },

    /**

     * Handle viewing pending (unresolved) bugs.

     */

    async handlePendingBugs(message, args) {

        const page = parseInt(args[0], 10) || 1;

        try {

            const bugs = await getUnresolvedBugs();

            await this.sendPaginatedBugs(message, bugs, page, 'Errores Pendientes');

        } catch (error) {

            console.error('Error al obtener los errores pendientes:', error);

            message.reply('❌ Ocurrió un error al obtener los errores pendientes.');

        }

    },

    /**

     * Handle viewing all bugs.

     */

    async handleAllBugs(message, args) {

        const page = parseInt(args[0], 10) || 1;

        try {

            const bugs = await getAllBugs();

            await this.sendPaginatedBugs(message, bugs, page, 'Todos los Errores');

        } catch (error) {

            console.error('Error al obtener todos los errores:', error);

            message.reply('❌ Ocurrió un error al obtener todos los errores.');

        }

    },

    /**

     * Handle counting bugs based on their status.

     */

    async handleBugCount(message, args) {

        const status = args[0]?.toLowerCase(); // Get the status (pendiente or resuelto)

        try {

            const bugs = await getAllBugs();

            let count;

            if (status === 'pendiente') {

                count = bugs.filter(bug => !bug.resolved).length;

            } else if (status === 'resuelto') {

                count = bugs.filter(bug => bug.resolved).length;

            } else {

                count = bugs.length;

            }

            const statusText = status ? ` (${status})` : '';

            message.reply(`✅ Hay **${count}** errores${statusText} en total.`);

        } catch (error) {

            console.error('Error al contar los errores:', error);

            message.reply('❌ Ocurrió un error al contar los errores.');

        }

    },

    /**

     * Handle resolving a bug by ID.

     */

    async handleResolveBug(message, args) {

        if (args.length < 1) {

            return message.reply('❌ Uso correcto: `!bug resolve <id>`');

        }

        const bugId = args[0];

        try {

            // Check if the bug exists

            const bug = await getBugById(bugId);

            if (!bug) {

                return message.reply('❌ No se encontró ningún error con ese ID.');

            }

            // Mark the bug as resolved

            await resolveBug(bugId);

            // Send a success message

            message.reply(`✅ El error **${bugId}** ha sido marcado como resuelto.`);

        } catch (error) {

            console.error('Error al resolver el error:', error);

            message.reply('❌ Ocurrió un error al resolver el error.');

        }

    },

    /**

     * Send paginated bugs with buttons.

     */

    async sendPaginatedBugs(message, bugs, page, title) {

        if (bugs.length === 0) {

            return message.reply('✅ No hay errores para mostrar.');

        }

        const totalPages = Math.ceil(bugs.length / BUGS_PER_PAGE);

        if (page < 1 || page > totalPages) {

            return message.reply(`❌ Página no válida. Elige una página entre 1 y ${totalPages}.`);

        }

        const startIndex = (page - 1) * BUGS_PER_PAGE;

        const endIndex = startIndex + BUGS_PER_PAGE;

        const bugsToShow = bugs.slice(startIndex, endIndex);

        const bugList = bugsToShow.map(bug => (

            `**ID:** ${bug.bug_id}\n` +

            `**Título:** ${bug.title}\n` +

            `**Reportado por:** ${bug.reported_by}\n` +

            `**Fecha:** ${bug.reported_at}\n` +

            `**Resuelto:** ${bug.resolved ? '✅' : '❌'}\n` +

            `---`

        )).join('\n');

        const embed = createEmbed(

            bugList,

            'info',

            `${title} (Página ${page}/${totalPages})`

        );

        // Add footer with the number of bugs being shown

        embed.setFooter({ text: `Mostrando ${bugsToShow.length} de ${bugs.length} errores` });

        // Add pagination buttons

        const buttons = new ActionRowBuilder().addComponents(

            new ButtonBuilder()

                .setCustomId('prev_page')

                .setLabel('⬅️ Anterior')

                .setStyle(ButtonStyle.Primary)

                .setDisabled(page <= 1),

            new ButtonBuilder()

                .setCustomId('next_page')

                .setLabel('➡️ Siguiente')

                .setStyle(ButtonStyle.Primary)

                .setDisabled(page >= totalPages)

        );

        const reply = await message.reply({ embeds: [embed], components: [buttons] });

        // Handle button interactions

        const filter = i => i.user.id === message.author.id;

        const collector = reply.createMessageComponentCollector({ filter, time: 60000 });

        collector.on('collect', async i => {

            if (i.customId === 'prev_page') {

                await this.sendPaginatedBugs(message, bugs, page - 1, title);

            } else if (i.customId === 'next_page') {

                await this.sendPaginatedBugs(message, bugs, page + 1, title);

            }

            await i.deferUpdate();

        });

        collector.on('end', () => {

            reply.edit({ components: [] });

        });

    }

};