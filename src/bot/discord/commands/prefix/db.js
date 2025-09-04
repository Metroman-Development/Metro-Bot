
const { EmbedBuilder } = require('discord.js');
const DatabaseManager = require('../../../../core/database/DatabaseManager');
const DBEmbed = require('../../../../templates/embeds/DBEmbed');
const CacheModel = require('../../../../core/database/models/CacheModel');
const BaseCommand = require('../BaseCommand');
const config = require('../../../../config');

class DbCommand extends BaseCommand {
    constructor() {
        super({
            name: 'db',
            description: '🔐 Database Management System',
            permissions: ['ADMINISTRATOR'],
        });

        this.subcommands = new Map([
            ['overview', this.handleOverview],
            ['tables', this.handleTables],
            ['query', this.handleQuery],
            ['cache', this.handleCache],
            ['maintenance', this.handleMaintenance],
            ['help', this.showHelp],
        ]);
    }

    async run(message) {
        if (!message.member.permissions.has('ADMINISTRATOR')) {
            return message.reply('You do not have permission to use this command.');
        }

        const args = message.content.slice(config.prefix.length).trim().split(/ +/);
        args.shift();

        const subcommandName = args[0]?.toLowerCase() || 'help';
        const subArgs = args.slice(1);
        const subcommand = this.subcommands.get(subcommandName) || this.showHelp;

        const db = await DatabaseManager.getInstance();
        const embed = new DBEmbed();

        await subcommand.call(this, message, db, embed, subArgs);
    }

    async handleOverview(message, db, embed) {
        const [[stats]] = await db.query(`
            SELECT 
                COUNT(*) AS tables,
                ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS size,
                MAX(update_time) AS updated
            FROM information_schema.TABLES 
            WHERE table_schema = DATABASE()
        `);

        const [[connStatus]] = await db.query(
            `SHOW STATUS LIKE 'Threads_connected'`
        );

        await message.channel.send({
            embeds: [embed.createOverview({
                tables: stats?.tables || 0,
                size: stats?.size || 0,
                connections: connStatus?.Value || 0,
                updated: stats?.updated || 'Never',
                uptime: this.formatUptime()
            })]
        });
    }

    async handleTables(message, db, embed) {
        const tables = await db.query(`
            SELECT TABLE_NAME
            FROM INFORMATION_SCHEMA.TABLES
            WHERE TABLE_SCHEMA = DATABASE()
        `);
        await message.channel.send({
            embeds: [embed.createTableList(tables)]
        });
    }

    async handleQuery(message, db, embed, args) {
        const query = args.join(' ');
        const start = Date.now();
        const [result] = await db.query(query);
        const duration = Date.now() - start;
        await message.channel.send({
            embeds: [embed.createQueryResult({
                ...result,
                duration
            })]
        });
    }

    async handleCache(message, db, embed, args) {
        const action = args[0];
        const cache = new CacheModel(db);
        if (action === 'clear') {
            const result = await cache.cleanup();
            await message.channel.send({
                embeds: [embed.createMaintenanceReport([{
                    Table: 'cache',
                    Op: 'CLEANUP',
                    Msg_type: `Removed ${result} entries`
                }])]
            });
        }
    }

    async handleMaintenance(message, db, embed) {
        const [optimize] = await db.query('OPTIMIZE TABLE cache');
        const [repair] = await db.query('REPAIR TABLE cache');
        await message.channel.send({
            embeds: [embed.createMaintenanceReport([
                ...optimize,
                ...repair
            ])]
        });
    }

    async showHelp(message, db, embed) {
        const helpEmbed = new EmbedBuilder()
            .setTitle('Database Command Help')
            .setColor(embed.colors.primary)
            .addFields(
                {
                    name: 'Commands', value: [
                        '`!db overview` - System statistics',
                        '`!db tables` - List tables',
                        '`!db query [SQL]` - Execute query',
                        '`!db cache clear` - Clear cache',
                        '`!db maintenance` - Optimize tables'
                    ].join('\n')
                }
            );
        await message.channel.send({ embeds: [helpEmbed] });
    }

    formatUptime() {
        const seconds = Math.floor(process.uptime() % 60);
        const minutes = Math.floor((process.uptime() / 60) % 60);
        const hours = Math.floor((process.uptime() / (60 * 60)) % 24);
        return `${hours}h ${minutes}m ${seconds}s`;
    }
}

module.exports = new DbCommand();

