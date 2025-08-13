const BaseEmbed = require('./baseEmbed');

class DBEmbed extends BaseEmbed {

    constructor() {

        super();

        this.colors = {

            primary: 0x3498db,

            success: 0x00ff00,

            error: 0xff0000,

            warning: 0xffcc00

        };

    }

    createOverview(data) {
    // Add null checks for all data
    const safeData = {
        tables: data.tables || 0,
        size: data.size || 0,
        connections: data.connections || 0,
        updated: data.updated || 'Unknown',
        uptime: data.uptime || '0h 0m 0s'
    };

    return this.createEmbed({
        title: '📊 Database Overview',
        color: this.colors.primary,
        fields: [
            {
                name: 'Tables',
                value: safeData.tables.toString(),
                inline: true
            },
            {
                name: 'Size',
                value: `${safeData.size} MB`,
                inline: true
            },
            {
                name: 'Connections',
                value: safeData.connections.toString(),
                inline: true
            },
            {
                name: 'Uptime',
                value: safeData.uptime,
                inline: true
            },
            {
                name: 'Last Updated',
                value: safeData.updated,
                inline: true
            }
        ]
    });
}

    createTableList(tables) {
    return this.createEmbed({
        title: '📋 Database Tables',
        description: tables
            .map(t => `• ${t.TABLE_NAME}`)
            .join('\n'),
        color: this.colors.primary,
        footer: {
            text: `Total: ${tables.length} tables`
        }
    });
}

    createQueryResult(result) {

        return this.createEmbed({

            title: '🔎 Query Results',

            color: this.colors.success,

            fields: [

                { name: 'Rows Affected', value: result.affectedRows.toString(), inline: true },

                { name: 'Execution Time', value: `${result.duration}ms`, inline: true }

            ]

        });

    }

    createMaintenanceReport(results) {

        return this.createEmbed({

            title: '🛠️ Maintenance Report',

            color: this.colors.warning,

            fields: results.map(r => ({

                name: r.Table,

                value: `Operation: ${r.Op}\nStatus: ${r.Msg_type}`,

                inline: true

            }))

        });

    }

    createError(error) {

        return this.createEmbed({

            title: '❌ Database Error',

            color: this.colors.error,

            description: `\`\`\`${error.message.slice(0, 1000)}\`\`\``,

            fields: [

                { name: 'Error Code', value: error.code || 'N/A', inline: true },

                { name: 'Solution', value: this.getSolution(error), inline: true }

            ]

        });

    }

    getSolution(error) {

        if(error.code === 'ER_NO_SUCH_TABLE') return 'Create missing table';

        if(error.code === 'ECONNREFUSED') return 'Check database server';

        return 'Review query syntax';

    }

}

module.exports = DBEmbed;
