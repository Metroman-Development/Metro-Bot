
const { EmbedBuilder } = require('discord.js');
const DatabaseManager = require('../core/database/DatabaseManager');
const DBEmbed = require('../templates/embeds/DBEmbed');
const CacheModel = require('../core/database/models/CacheModel');
const logger = require('../events/logger');

module.exports = {
    name: 'db',
    description: '🔐 Database Management System',
    permissions: ['ADMINISTRATOR'],
    
    async execute(message, args) {
        const db = await DatabaseManager.getInstance();
        const embed = new DBEmbed();
        
        try {
            const subcommand = args[0]?.toLowerCase();
            
            switch(subcommand) {
                case 'overview':
                    await this.handleOverview(message, db, embed);
                    break;
                    
                case 'tables':
                    await this.handleTables(message, db, embed);
                    break;
                    
                case 'query':
                    await this.handleQuery(message, db, embed, args.slice(1));
                    break;
                    
                case 'cache':
                    await this.handleCache(message, db, embed, args[1]);
                    break;
                    
                case 'maintenance':
                    await this.handleMaintenance(message, db, embed);
                    break;
                    
                default:
                    await this.showHelp(message, embed);
            }
        } catch (error) {
            await message.channel.send({ embeds: [embed.createError(error)] });
        }
    },

    

    async handleOverview(message, db, embed) {
    try {
        // Get database statistics - properly destructure results
        const [[stats]] = await db.query(`
            SELECT 
                COUNT(*) AS tables,
                ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS size,
                MAX(update_time) AS updated
            FROM information_schema.TABLES 
            WHERE table_schema = DATABASE()
        `);
        
        // Get connection count - properly destructure results
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
    } catch (error) {
        console.error('Overview error:', error);
        await message.channel.send({ 
            embeds: [embed.createError(error)] 
        });
    }
}, 
    
    async handleTables(message, db, embed) {
    const tables = await db.query(`
        SELECT TABLE_NAME 
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = DATABASE()
    `);
    
    await message.channel.send({ 
        embeds: [embed.createTableList(tables)] 
    });
}, 
    
    async handleQuery(message, db, embed, args) {
        const query = args.join(' ');
        const start = Date.now();
        const [result] = await db.query(query);
        const duration = Date.now() - start;
        
        await message.channel.send({ embeds: [embed.createQueryResult({
            ...result,
            duration
        })] });
    },

    async handleCache(message, db, embed, action) {
        const cache = new CacheModel(db);
        
        if(action === 'clear') {
            const result = await cache.cleanup();
            await message.channel.send({ embeds: [embed.createMaintenanceReport([{
                Table: 'cache',
                Op: 'CLEANUP',
                Msg_type: `Removed ${result} entries`
            }])
   ]});
 }
               }, 

    async handleMaintenance(message, db, embed) {
        const [optimize] = await db.query('OPTIMIZE TABLE cache');
        const [repair] = await db.query('REPAIR TABLE cache');
        await message.channel.send({ embeds: [embed.createMaintenanceReport([
            ...optimize,
            ...repair
       ])] });
    },

    async showHelp(message, embed) {
        const helpEmbed = new EmbedBuilder()
            .setTitle('Database Command Help')
            .setColor(embed.colors.primary)
            .addFields(
                { name: 'Commands', value: [
                    '`!db overview` - System statistics',
                    '`!db tables` - List tables',
                    '`!db query [SQL]` - Execute query',
                    '`!db cache clear` - Clear cache',
                    '`!db maintenance` - Optimize tables'
                ].join('\n') }
            );
            
        await message.channel.send({ embeds: [helpEmbed] });
    },

    formatUptime() {
        const seconds = Math.floor(process.uptime() % 60);
        const minutes = Math.floor((process.uptime() / 60) % 60);
        const hours = Math.floor((process.uptime() / (60 * 60)) % 24);
        return `${hours}h ${minutes}m ${seconds}s`;
    }
};

