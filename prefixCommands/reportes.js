
const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const DatabaseManager = require('../core/database/DatabaseManager');
const logger = require('../events/logger');

module.exports = {
    name: 'reportes',
    description: '📊 Comprehensive metro reports management system',
    permissions: ['ADMINISTRATOR'],
    
    async execute(message, args) {
        const db = await DatabaseManager.getInstance();
        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTimestamp();
        
        try {
            const subcommand = args[0]?.toLowerCase();
            
            switch(subcommand) {
                case 'list':
                    await this.handleListReports(message, db, embed, args[1]);
                    break;
                    
                case 'cleanup':
                    await this.handleCleanup(message, db, embed, args[1]);
                    break;
                    
                case 'stats':
                    await this.handleStats(message, db, embed);
                    break;
                    
                case 'search':
                    await this.handleSearch(message, db, embed, args.slice(1));
                    break;
                    
                case 'update':
                    if (args[1] === 'bulk') {
                        await this.handleBulkUpdate(message, db);
                    } else {
                        await this.handleUpdateStatus(message, db, embed, args.slice(1));
                    }
                    break;
                    
                case 'view':
                    await this.handleViewReport(message, db, embed, args[1]);
                    break;
                    
                case 'export':
                    await this.handleExportReports(message, db, embed, args.slice(1));
                    break;
                    
                default:
                    await this.showHelp(message, embed);
            }
        } catch (error) {
            logger.error('Reportes command execution failed:', {
                error: error.message,
                stack: error.stack,
                command: 'reportes',
                args: args,
                userId: message.author.id,
                channelId: message.channel.id
            });
            
            embed.setColor('#ff0000')
                 .setTitle('Command Execution Failed')
                 .setDescription('❌ An error occurred while processing your request. The error has been logged.')
                 .addFields(
                    { name: 'Error', value: error.message.length > 1000 ? error.message.substring(0, 1000) + '...' : error.message }
                 );
            
            if (error.stack) {
                embed.addFields({
                    name: 'Technical Details',
                    value: '```' + error.stack.substring(0, 1000) + (error.stack.length > 1000 ? '...' : '') + '```'
                });
            }
            
            await message.channel.send({ embeds: [embed] });
        }
    },

    async handleListReports(message, db, embed, limit = '50') {
        const maxLimit = Math.min(parseInt(limit) || 50, 100);
        const [reports] = await db.query(
            `SELECT id, linea, problema, status, created_at 
             FROM reports 
             ORDER BY created_at DESC 
             LIMIT ?`, 
            [maxLimit]
        );
        
        if (reports.length === 0) {
            embed.setDescription('No reports found in the database.');
            return message.channel.send({ embeds: [embed] });
        }
        
        embed.setTitle(`📋 Last ${reports.length} Reports`)
             .setDescription('Here are the most recent reports:');
        
        // Split into chunks of 10 fields per embed (Discord limit)
        const chunks = [];
        for (let i = 0; i < reports.length; i += 10) {
            const chunk = reports.slice(i, i + 10);
            const chunkEmbed = new EmbedBuilder(embed.toJSON());
            
            chunk.forEach(report => {
                chunkEmbed.addFields({
                    name: `#${report.id} - Line ${report.linea} (${report.status})`,
                    value: `**Issue:** ${report.problema}\n**Date:** ${report.created_at.toLocaleString()}`,
                    inline: true
                });
            });
            
            chunks.push(chunkEmbed);
        }
        
        for (const chunk of chunks) {
            await message.channel.send({ embeds: [chunk] });
        }
    },

    async handleCleanup(message, db, embed, days = 'all') {
        try {
            let query;
            let params = [];
            let description;
            
            if (days.toLowerCase() === 'all') {
                query = 'DELETE FROM reports';
                description = 'ALL reports from the database';
            } else {
                const daysToKeep = parseInt(days) || 30;
                if (daysToKeep < 1) {
                    throw new Error('Days parameter must be at least 1 or "all"');
                }
                query = 'DELETE FROM reports WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)';
                params = [daysToKeep];
                description = `reports older than ${daysToKeep} days`;
            }
            
            // Get count of records that will be deleted
            const countQuery = query.replace('DELETE', 'SELECT COUNT(*) as count');
            const [countResult] = await db.query(countQuery, params);
            const count = countResult[0].count;
            
            if (count === 0) {
                embed.setColor('#ffcc00')
                     .setTitle('No Reports to Cleanup')
                     .setDescription('No reports match your cleanup criteria.');
                return message.channel.send({ embeds: [embed] });
            }
            
            // Confirmation
            const confirmEmbed = new EmbedBuilder()
                .setColor('#ffcc00')
                .setTitle('⚠️ Confirm Cleanup')
                .setDescription(`You are about to delete ${count} ${description}. This action cannot be undone.`)
                .setFooter({ text: 'React with ✅ to confirm or ❌ to cancel' });
            
            const confirmMessage = await message.channel.send({ embeds: [confirmEmbed] });
            await confirmMessage.react('✅');
            await confirmMessage.react('❌');
            
            const filter = (reaction, user) => {
                return ['✅', '❌'].includes(reaction.emoji.name) && user.id === message.author.id;
            };
            
            const reactions = await confirmMessage.awaitReactions({ 
                filter, 
                max: 1, 
                time: 30000, 
                errors: ['time'] 
            });
            
            const reaction = reactions.first();
            if (reaction.emoji.name === '❌') {
                embed.setColor('#ffcc00')
                     .setTitle('Cleanup Cancelled')
                     .setDescription('Report cleanup was cancelled.');
                return message.channel.send({ embeds: [embed] });
            }
            
            // Execute deletion
            const [result] = await db.query(query, params);
            
            embed.setColor('#00ff00')
                 .setTitle('✅ Cleanup Complete')
                 .setDescription(`Successfully deleted ${result.affectedRows} ${description}.`);
            
            await message.channel.send({ embeds: [embed] });
            
        } catch (error) {
            if (error.name === 'TimeoutError') {
                embed.setColor('#ffcc00')
                     .setTitle('Cleanup Timed Out')
                     .setDescription('Confirmation not received in time. Cleanup cancelled.');
                await message.channel.send({ embeds: [embed] });
            } else {
                throw error;
            }
        }
    },

    async handleStats(message, db, embed) {
        const [stats] = await db.query(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'pendiente' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN status = 'en_proceso' THEN 1 ELSE 0 END) as in_progress,
                SUM(CASE WHEN status = 'resuelto' THEN 1 ELSE 0 END) as resolved,
                MIN(created_at) as oldest,
                MAX(created_at) as newest
            FROM reports
        `);
        
        const [lineStats] = await db.query(`
            SELECT 
                linea,
                COUNT(*) as count,
                ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM reports), 1) as percentage
            FROM reports
            GROUP BY linea
            ORDER BY count DESC
        `);
        
        const [typeStats] = await db.query(`
            SELECT 
                problema,
                COUNT(*) as count
            FROM reports
            GROUP BY problema
            ORDER BY count DESC
            LIMIT 5
        `);
        
        embed.setTitle('📊 Report Statistics')
             .addFields(
                { name: 'Total Reports', value: stats[0].total.toString(), inline: true },
                { name: 'Pending', value: stats[0].pending.toString(), inline: true },
                { name: 'In Progress', value: stats[0].in_progress.toString(), inline: true },
                { name: 'Resolved', value: stats[0].resolved.toString(), inline: true },
                { name: 'Oldest Report', value: stats[0].oldest?.toLocaleDateString() || 'None', inline: true },
                { name: 'Newest Report', value: stats[0].newest?.toLocaleDateString() || 'None', inline: true }
             );
             
        let lineStatsText = '';
        lineStats.forEach(stat => {
            lineStatsText += `**Line ${stat.linea}:** ${stat.count} (${stat.percentage}%)\n`;
        });
        
        let typeStatsText = '';
        typeStats.forEach(stat => {
            typeStatsText += `**${stat.problema}:** ${stat.count}\n`;
        });
        
        embed.addFields(
            { name: 'Reports by Line', value: lineStatsText || 'No data', inline: true },
            { name: 'Top 5 Issue Types', value: typeStatsText || 'No data', inline: true }
        );
        
        await message.channel.send({ embeds: [embed] });
    },

    async handleSearch(message, db, embed, args) {
        if (args.length === 0) {
            throw new Error('Please provide a search term (line number, status, or keyword)');
        }
        
        const searchTerm = args.join(' ');
        const isLineSearch = /^[1-6A]?$/.test(searchTerm);
        const isStatusSearch = ['pendiente', 'en_proceso', 'resuelto'].includes(searchTerm.toLowerCase());
        
        let query;
        let params;
        
        if (isLineSearch) {
            query = `SELECT id, linea, problema, status, created_at 
                     FROM reports 
                     WHERE linea = ? 
                     ORDER BY created_at DESC 
                     LIMIT 25`;
            params = [searchTerm];
        } else if (isStatusSearch) {
            query = `SELECT id, linea, problema, status, created_at 
                     FROM reports 
                     WHERE status = ? 
                     ORDER BY created_at DESC 
                     LIMIT 25`;
            params = [searchTerm.toLowerCase()];
        } else {
            query = `SELECT id, linea, problema, status, created_at 
                     FROM reports 
                     WHERE problema LIKE ? OR descripcion LIKE ? 
                     ORDER BY created_at DESC 
                     LIMIT 25`;
            params = [`%${searchTerm}%`, `%${searchTerm}%`];
        }
        
        const [results] = await db.query(query, params);
        
        if (results.length === 0) {
            embed.setDescription(`No reports found matching "${searchTerm}".`);
            return message.channel.send({ embeds: [embed] });
        }
        
        embed.setTitle(`🔍 Search Results for "${searchTerm}"`)
             .setDescription(`Found ${results.length} matching reports:`);
        
        // Split into chunks of 10 fields per embed
        const chunks = [];
        for (let i = 0; i < results.length; i += 10) {
            const chunk = results.slice(i, i + 10);
            const chunkEmbed = new EmbedBuilder(embed.toJSON());
            
            chunk.forEach(report => {
                chunkEmbed.addFields({
                    name: `#${report.id} - Line ${report.linea} (${report.status})`,
                    value: `**Issue:** ${report.problema}\n**Date:** ${report.created_at.toLocaleString()}`,
                    inline: true
                });
            });
            
            chunks.push(chunkEmbed);
        }
        
        for (const chunk of chunks) {
            await message.channel.send({ embeds: [chunk] });
        }
    },

    async handleUpdateStatus(message, db, embed, args) {
        if (args.length < 2) {
            throw new Error('Usage: `!reportes update <report_id> <status>`\nValid statuses: pendiente, en_proceso, resuelto');
        }

        const reportId = args[0];
        const newStatus = args[1].toLowerCase();
        const validStatuses = ['pendiente', 'en_proceso', 'resuelto'];

        if (!validStatuses.includes(newStatus)) {
            throw new Error(`Invalid status. Valid options are: ${validStatuses.join(', ')}`);
        }

        const [report] = await db.query(
            'SELECT id, linea, problema, status FROM reports WHERE id = ?',
            [reportId]
        );

        if (report.length === 0) {
            throw new Error(`Report with ID ${reportId} not found`);
        }

        await db.query(
            'UPDATE reports SET status = ?, updated_at = NOW() WHERE id = ?',
            [newStatus, reportId]
        );

        embed.setTitle('✅ Status Updated')
             .setDescription(`Report #${reportId} status changed from \`${report[0].status}\` to \`${newStatus}\``)
             .addFields(
                { name: 'Line', value: report[0].linea, inline: true },
                { name: 'Issue', value: report[0].problema, inline: true }
             );

        await message.channel.send({ embeds: [embed] });
    },

    async handleViewReport(message, db, embed, reportId) {
        if (!reportId) {
            throw new Error('Please provide a report ID to view');
        }

        const [report] = await db.query(
            `SELECT 
                id, 
                linea, 
                problema, 
                descripcion, 
                status, 
                ip, 
                created_at,
                updated_at
             FROM reports 
             WHERE id = ?`,
            [reportId]
        );

        if (report.length === 0) {
            throw new Error(`Report with ID ${reportId} not found`);
        }

        const reportData = report[0];
        
        embed.setTitle(`📝 Report #${reportData.id}`)
             .addFields(
                { name: 'Line', value: reportData.linea, inline: true },
                { name: 'Status', value: reportData.status, inline: true },
                { name: 'Created', value: reportData.created_at.toLocaleString(), inline: true },
                { name: 'Last Updated', value: reportData.updated_at?.toLocaleString() || 'Never', inline: true },
                { name: 'Issue Type', value: reportData.problema, inline: true },
                { name: 'Description', value: reportData.descripcion || 'No description provided' }
             )
             .setFooter({ text: `IP: ${reportData.ip}` });

        const row = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId(`report_status_update_${reportData.id}`)
                .setPlaceholder('Change status...')
                .addOptions(
                    {
                        label: 'Pending',
                        value: 'pendiente',
                        description: 'Mark as pending',
                        emoji: '🟡'
                    },
                    {
                        label: 'In Progress',
                        value: 'en_proceso',
                        description: 'Mark as in progress',
                        emoji: '🔵'
                    },
                    {
                        label: 'Resolved',
                        value: 'resuelto',
                        description: 'Mark as resolved',
                        emoji: '🟢'
                    }
                )
        );

        await message.channel.send({ 
            embeds: [embed],
            components: [row] 
        });
    },

    async handleBulkUpdate(message, db) {
        const modal = new ModalBuilder()
            .setCustomId('bulk_update_reports')
            .setTitle('Bulk Update Reports');

        const startDateInput = new TextInputBuilder()
            .setCustomId('start_date')
            .setLabel("Start Date (YYYY-MM-DD)")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder('2023-01-01');

        const endDateInput = new TextInputBuilder()
            .setCustomId('end_date')
            .setLabel("End Date (YYYY-MM-DD)")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder('2023-12-31');

        const lineInput = new TextInputBuilder()
            .setCustomId('lines')
            .setLabel("Lines to include (comma-separated)")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setPlaceholder('1,2,4A or leave empty for all');

        const statusInput = new TextInputBuilder()
            .setCustomId('current_status')
            .setLabel("Current status to filter")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setPlaceholder('pendiente, en_proceso or leave empty');

        const issueTypeInput = new TextInputBuilder()
            .setCustomId('issue_type')
            .setLabel("Issue type to filter")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setPlaceholder('Delay, Overcrowding, etc.');

        modal.addComponents(
            new ActionRowBuilder().addComponents(startDateInput),
            new ActionRowBuilder().addComponents(endDateInput),
            new ActionRowBuilder().addComponents(lineInput),
            new ActionRowBuilder().addComponents(statusInput),
            new ActionRowBuilder().addComponents(issueTypeInput)
        );

        await message.showModal(modal);

        const filter = (interaction) => interaction.customId === 'bulk_update_reports' && interaction.user.id === message.author.id;
        
        try {
            const interaction = await message.awaitModalSubmit({ filter, time: 60000 });
            
            const startDate = interaction.fields.getTextInputValue('start_date');
            const endDate = interaction.fields.getTextInputValue('end_date');
            const lines = interaction.fields.getTextInputValue('lines');
            const currentStatus = interaction.fields.getTextInputValue('current_status');
            const issueType = interaction.fields.getTextInputValue('issue_type');

            if (!this.isValidDate(startDate) || !this.isValidDate(endDate)) {
                await interaction.reply({ content: '❌ Invalid date format. Use YYYY-MM-DD', ephemeral: true });
                return;
            }

            const filters = [];
            const params = [];

            filters.push('created_at BETWEEN ? AND ?');
            params.push(startDate, endDate + ' 23:59:59');

            if (lines) {
                const lineArray = lines.split(',').map(l => l.trim());
                filters.push(`linea IN (${lineArray.map(() => '?').join(',')})`);
                params.push(...lineArray);
            }

            if (currentStatus) {
                filters.push('status = ?');
                params.push(currentStatus);
            }

            if (issueType) {
                filters.push('problema LIKE ?');
                params.push(`%${issueType}%`);
            }

            const [results] = await db.query(
                `SELECT COUNT(*) as count FROM reports WHERE ${filters.join(' AND ')}`,
                params
            );

            const count = results[0].count;

            if (count === 0) {
                await interaction.reply({ content: '❌ No reports match your criteria', ephemeral: true });
                return;
            }

            const previewEmbed = new EmbedBuilder()
                .setTitle('⚠️ Confirm Bulk Update')
                .setDescription(`You're about to update **${count} reports** matching these criteria:`)
                .addFields(
                    { name: 'Date Range', value: `${startDate} to ${endDate}` },
                    { name: 'Lines', value: lines || 'All lines' },
                    { name: 'Current Status', value: currentStatus || 'Any status' },
                    { name: 'Issue Type', value: issueType || 'Any type' }
                )
                .setColor('#ffcc00');

            const row = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId(`bulk_update_status_${message.id}`)
                    .setPlaceholder('Select new status...')
                    .addOptions(
                        {
                            label: 'Pending',
                            value: 'pendiente',
                            emoji: '🟡'
                        },
                        {
                            label: 'In Progress',
                            value: 'en_proceso',
                            emoji: '🔵'
                        },
                        {
                            label: 'Resolved',
                            value: 'resuelto',
                            emoji: '🟢'
                        }
                    )
            );

            await interaction.reply({
                content: `Found ${count} matching reports. Select the new status:`,
                embeds: [previewEmbed],
                components: [row],
                ephemeral: true
            });

            const statusFilter = (i) => i.customId === `bulk_update_status_${message.id}` && i.user.id === message.author.id;
            const statusInteraction = await message.awaitMessageComponent({ filter: statusFilter, time: 60000 });

            const newStatus = statusInteraction.values[0];

            await db.query(
                `UPDATE reports SET status = ?, updated_at = NOW() WHERE ${filters.join(' AND ')}`,
                [newStatus, ...params]
            );

            await statusInteraction.update({
                content: `✅ Successfully updated ${count} reports to status: \`${newStatus}\``,
                embeds: [],
                components: []
            });

        } catch (error) {
            if (error.name === 'TimeoutError') {
                await message.channel.send('❌ Bulk update timed out. Please try again.');
            } else {
                throw error;
            }
        }
    },

    async handleExportReports(message, db, embed, args) {
        const format = args[0]?.toLowerCase() || 'csv';
        
        if (!['csv', 'json'].includes(format)) {
            throw new Error('Invalid format. Use either "csv" or "json"');
        }

        const [reports] = await db.query(
            `SELECT id, linea, problema, descripcion, status, created_at, updated_at, ip 
             FROM reports 
             ORDER BY created_at DESC 
             LIMIT 1000`
        );

        if (reports.length === 0) {
            embed.setDescription('No reports to export.');
            return message.channel.send({ embeds: [embed] });
        }

        let exportData;
        if (format === 'csv') {
            const headers = Object.keys(reports[0]).join(',');
            const rows = reports.map(report => 
                Object.values(report).map(value => 
                    typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value
                ).join(',')
            );
            exportData = [headers, ...rows].join('\n');
        } else {
            exportData = JSON.stringify(reports, null, 2);
        }

        await message.channel.send({
            content: `Here's the exported data (${reports.length} reports):`,
            files: [{
                attachment: Buffer.from(exportData),
                name: `reports_export.${format}`
            }]
        });
    },

    isValidDate(dateString) {
        const regEx = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateString.match(regEx)) return false;
        const d = new Date(dateString);
        return d instanceof Date && !isNaN(d);
    },

    async showHelp(message, embed) {
        embed.setTitle('📊 Reportes Command Help')
             .setDescription('Comprehensive metro reports management system')
             .addFields(
                { name: 'Commands', value: [
                    '`!reportes list [limit]` - List recent reports (default: 50, max: 100)',
                    '`!reportes cleanup [days|all]` - Delete reports older than X days or all reports',
                    '`!reportes stats` - Show detailed report statistics',
                    '`!reportes search <term>` - Search reports by line, status, or keyword',
                    '`!reportes update <id> <status>` - Update single report status',
                    '`!reportes update bulk` - Bulk update reports with filters',
                    '`!reportes view <id>` - View full report details',
                    '`!reportes export [csv|json]` - Export reports (default: csv)'
                ].join('\n') },
                { name: 'Status Options', value: '`pendiente`, `en_proceso`, `resuelto`' },
                { name: 'Bulk Update Filters', value: 'Date range, lines, current status, and issue type' }
             )
             .setFooter({ text: 'All commands require ADMINISTRATOR permissions' });
             
        await message.channel.send({ embeds: [embed] });
    }
};
