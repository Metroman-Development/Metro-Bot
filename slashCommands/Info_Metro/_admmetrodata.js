// In your command handler
const { 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    StringSelectMenuBuilder,
    ComponentType
} = require('discord.js');
const MetroDataFramework = require('../../modules/metro/data/framework/MetroDataFramework');
const path = require('path');
const { 
    buttons,
    selectMenus,
    modals,
    interactionStore,
    BaseButton,
    BaseSelectMenu,
    BaseModal
} = require('../../modules/interactions');

// Constants
const DATA_EXPIRY = 3600000; // 1 hour for interaction data
const COLORS = {
    info: '#0099ff',
    success: '#00cc66',
    warning: '#ffcc00',
    error: '#ff0000'
};

class MetroDataManager {
    constructor() {
        this.framework = new MetroDataFramework({
            basePath: path.join(process.cwd(), 'metro-data', 'stations'),
            emitter: new (require('events'))()
        });
        this.framework.emitter.on('error', console.error);
    }

    // ========================
    // COMPONENT REGISTRATION
    // ========================

    static registerComponents() {
        // View Station Button
        buttons.register(new class extends BaseButton {
            constructor() {
                super();
                this.customIdPrefix = 'metro-view-btn';
                this.cooldown = 3000;
            }

            async handleInteraction(interaction, { lineId, stationId }) {
                const manager = new MetroDataManager();
                try {
                    await manager.framework.loadNetwork();
                    const station = await manager.framework.getStation(lineId, stationId);
                    
                    if (!station) {
                        return interaction.reply({
                            embeds: [manager.createEmbed('error', 'Station not found')],
                            ephemeral: true
                        });
                    }

                    const embed = manager.createStationEmbed(lineId, stationId, station);
                    const components = manager.createStationActionRow(lineId, stationId);
                    
                    await interaction.update({
                        embeds: [embed],
                        components: [components]
                    });
                } catch (error) {
                    console.error('View station button failed:', error);
                    await interaction.reply({
                        embeds: [manager.createEmbed('error', 'Failed to view station')],
                        ephemeral: true
                    });
                }
            }
        });

        // Edit Station Button
        buttons.register(new class extends BaseButton {
            constructor() {
                super();
                this.customIdPrefix = 'metro-edit-btn';
                this.cooldown = 5000;
            }

            async handleInteraction(interaction, { lineId, stationId }) {
                const manager = new MetroDataManager();
                try {
                    await manager.framework.loadNetwork();
                    const station = await manager.framework.getStation(lineId, stationId);
                    
                    if (!station) {
                        return interaction.reply({
                            embeds: [manager.createEmbed('error', 'Station not found')],
                            ephemeral: true
                        });
                    }

                    const modal = new modals.get('metro-edit-modal');
                    await interaction.showModal(
                        await modal.build({ lineId, stationId, currentData: station })
                    );
                } catch (error) {
                    console.error('Edit station button failed:', error);
                    await interaction.reply({
                        embeds: [manager.createEmbed('error', 'Failed to edit station')],
                        ephemeral: true
                    });
                }
            }
        });

        // Delete Station Button
        buttons.register(new class extends BaseButton {
            constructor() {
                super();
                this.customIdPrefix = 'metro-delete-btn';
                this.cooldown = 10000;
            }

            async handleInteraction(interaction, { lineId, stationId }) {
                const manager = new MetroDataManager();
                try {
                    await manager.framework.loadNetwork();
                    const station = await manager.framework.getStation(lineId, stationId);
                    
                    if (!station) {
                        return interaction.reply({
                            embeds: [manager.createEmbed('error', 'Station not found')],
                            ephemeral: true
                        });
                    }

                    const confirmEmbed = manager.createEmbed(
                        'warning',
                        `Confirm deletion of ${station.basicInfo.name} (${lineId.toUpperCase()})`,
                        'This action cannot be undone'
                    );

                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId(`metro-confirm-delete_${lineId}_${stationId}`)
                            .setLabel('CONFIRM DELETE')
                            .setStyle(ButtonStyle.Danger),
                        new ButtonBuilder()
                            .setCustomId('metro-cancel-action')
                            .setLabel('Cancel')
                            .setStyle(ButtonStyle.Secondary)
                    );

                    await interaction.update({
                        embeds: [confirmEmbed],
                        components: [row]
                    });
                } catch (error) {
                    console.error('Delete station button failed:', error);
                    await interaction.reply({
                        embeds: [manager.createEmbed('error', 'Failed to delete station')],
                        ephemeral: true
                    });
                }
            }
        });

        // Confirm Delete Button
        buttons.register(new class extends BaseButton {
            constructor() {
                super();
                this.customIdPrefix = 'metro-confirm-delete';
                this.cooldown = 15000;
            }

            async handleInteraction(interaction, { lineId, stationId }) {
                const manager = new MetroDataManager();
                try {
                    await manager.framework.loadNetwork();
                    await manager.framework.updateStation(lineId, stationId, { _deleted: true });
                    
                    await interaction.update({
                        embeds: [manager.createEmbed('success', 'Station deleted successfully')],
                        components: []
                    });
                } catch (error) {
                    console.error('Confirm delete failed:', error);
                    await interaction.reply({
                        embeds: [manager.createEmbed('error', 'Failed to delete station')],
                        ephemeral: true
                    });
                }
            }
        });

        // Cancel Action Button
        buttons.register(new class extends BaseButton {
            constructor() {
                super();
                this.customIdPrefix = 'metro-cancel-action';
            }

            async handleInteraction(interaction) {
                await interaction.update({
                    embeds: [new EmbedBuilder().setDescription('Action cancelled')],
                    components: []
                });
            }
        });

        // Station Select Menu
        selectMenus.register(new class extends BaseSelectMenu {
            constructor() {
                super();
                this.customIdPrefix = 'metro-station-select';
            }

            async handleInteraction(interaction, { action }, selectedValues) {
                const manager = new MetroDataManager();
                try {
                    const [lineId, stationId] = selectedValues[0].split(':');
                    
                    switch (action) {
                        case 'view':
                            await manager.handleViewStation(interaction, lineId, stationId);
                            break;
                        case 'edit':
                            await manager.handleEditStation(interaction, lineId, stationId);
                            break;
                        case 'delete':
                            await manager.handleDeleteStation(interaction, lineId, stationId);
                            break;
                        default:
                            throw new Error('Unknown action');
                    }
                } catch (error) {
                    console.error('Station select failed:', error);
                    await interaction.reply({
                        embeds: [manager.createEmbed('error', 'Failed to process selection')],
                        ephemeral: true
                    });
                }
            }
        });

        // Edit Station Modal
        modals.register(new class extends BaseModal {
            constructor() {
                super();
                this.customIdPrefix = 'metro-edit-modal';
            }

            async build({ lineId, stationId, currentData }) {
                const modal = new ModalBuilder()
                    .setCustomId(this.generateCustomId({ lineId, stationId }))
                    .setTitle(`Edit ${currentData.basicInfo.name}`);
                
                // Basic Info
                const nameInput = new TextInputBuilder()
                    .setCustomId('name-input')
                    .setLabel("Station Name")
                    .setStyle(TextInputStyle.Short)
                    .setValue(currentData.basicInfo.name || '')
                    .setRequired(true);
                
                // Status
                const statusInput = new TextInputBuilder()
                    .setCustomId('status-input')
                    .setLabel("Status Description")
                    .setStyle(TextInputStyle.Short)
                    .setValue(currentData.status.description || '')
                    .setRequired(true);
                
                // Services
                const servicesInput = new TextInputBuilder()
                    .setCustomId('services-input')
                    .setLabel("Available Services (comma separated)")
                    .setStyle(TextInputStyle.Paragraph)
                    .setValue(Object.keys(currentData.services.tickets || {}).join(', '))
                    .setRequired(false);
                
                modal.addComponents(
                    new ActionRowBuilder().addComponents(nameInput),
                    new ActionRowBuilder().addComponents(statusInput),
                    new ActionRowBuilder().addComponents(servicesInput)
                );
                
                return modal;
            }

            async handleInteraction(interaction, { lineId, stationId }) {
                const manager = new MetroDataManager();
                try {
                    const fields = interaction.fields;
                    const name = fields.getTextInputValue('name-input');
                    const status = fields.getTextInputValue('status-input');
                    const services = fields.getTextInputValue('services-input')
                        .split(',')
                        .map(s => s.trim())
                        .filter(s => s.length > 0);
                    
                    const updateData = {
                        basicInfo: { name },
                        status: { description: status },
                        services: { tickets: {} },
                        _meta: { lastUpdated: new Date().toISOString() }
                    };
                    
                    services.forEach(service => {
                        updateData.services.tickets[service] = true;
                    });
                    
                    await manager.framework.loadNetwork();
                    await manager.framework.updateStation(lineId, stationId, updateData);
                    
                    await interaction.reply({
                        embeds: [manager.createEmbed('success', 'Station updated successfully')],
                        ephemeral: true
                    });
                } catch (error) {
                    console.error('Edit modal failed:', error);
                    await interaction.reply({
                        embeds: [manager.createEmbed('error', 'Failed to update station')],
                        ephemeral: true
                    });
                }
            }
        });
    }

    // ========================
    // UTILITY METHODS
    // ========================

    createEmbed(type, title, footer = '') {
        return new EmbedBuilder()
            .setColor(COLORS[type] || COLORS.info)
            .setTitle(title)
            .setFooter(footer ? { text: footer } : null)
            .setTimestamp();
    }

    createStationEmbed(lineId, stationId, stationData) {
        return new EmbedBuilder()
            .setTitle(`ℹ️ ${stationData.basicInfo.name} (${stationData.basicInfo.code})`)
            .setColor(this.framework.getLineColor(lineId))
            .addFields(
                { name: 'Line', value: lineId.toUpperCase(), inline: true },
                { name: 'Status', value: stationData.status.description, inline: true },
                { name: 'Services', value: Object.keys(stationData.services.tickets || {}).join(', ') || 'None', inline: false }
            )
            .setFooter({ 
                text: `Last updated: ${new Date(stationData._meta?.lastUpdated || stationData._meta?.generatedAt).toLocaleString()}` 
            });
    }

    createStationActionRow(lineId, stationId) {
        return new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`metro-edit-btn_${lineId}_${stationId}`)
                .setLabel('Edit')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`metro-delete-btn_${lineId}_${stationId}`)
                .setLabel('Delete')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId(`metro-view-btn_${lineId}_${stationId}`)
                .setLabel('Refresh')
                .setStyle(ButtonStyle.Secondary)
        );
    }

    // ========================
    // COMMAND HANDLERS
    // ========================

    async handleCommand(interaction) {
        await interaction.deferReply({ ephemeral: true });
        
        const action = interaction.options.getString('action');
        const lineId = interaction.options.getString('line-id');
        const stationId = interaction.options.getString('station-id');
        
        try {
            await this.framework.loadNetwork();
            
            switch(action) {
                case 'view-station':
                    return this.handleViewStation(interaction, lineId, stationId);
                case 'edit-station':
                    return this.handleEditStation(interaction, lineId, stationId);
                case 'create-station':
                    return this.handleCreateStation(interaction, lineId);
                case 'delete-station':
                    return this.handleDeleteStation(interaction, lineId, stationId);
                case 'list-stations':
                    return this.handleListStations(interaction, lineId);
                case 'verify-data':
                    return this.handleVerifyData(interaction);
                case 'export-data':
                    return this.handleExportData(interaction);
                default:
                    throw new Error('Unknown action');
            }
        } catch (error) {
            console.error('Metro data command failed:', error);
            await interaction.editReply({
                embeds: [this.createEmbed('error', `❌ Operation Failed: ${error.message}`)],
                ephemeral: true
            });
        }
    }

    async handleViewStation(interaction, lineId, stationId) {
        if (!lineId || !stationId) {
            return this.promptStationSelection(interaction, 'view', lineId);
        }
        
        const station = await this.framework.getStation(lineId, stationId);
        if (!station) {
            throw new Error(`Station ${stationId} on line ${lineId} not found`);
        }
        
        const embed = this.createStationEmbed(lineId, stationId, station);
        const row = this.createStationActionRow(lineId, stationId);
        
        await interaction.editReply({ embeds: [embed], components: [row] });
    }

    async handleEditStation(interaction, lineId, stationId) {
        if (!lineId || !stationId) {
            return this.promptStationSelection(interaction, 'edit', lineId);
        }
        
        const station = await this.framework.getStation(lineId, stationId);
        if (!station) {
            throw new Error(`Station ${stationId} on line ${lineId} not found`);
        }
        
        const modal = modals.get('metro-edit-modal');
        await interaction.showModal(
            await modal.build({ lineId, stationId, currentData: station })
        );
    }

    async handleCreateStation(interaction, lineId) {
        if (!lineId) {
            throw new Error('Line ID is required to create a station');
        }
        
        const modal = new ModalBuilder()
            .setCustomId(`metro-create-modal_${lineId}`)
            .setTitle(`Create New Station on ${lineId.toUpperCase()}`);
        
        const stationIdInput = new TextInputBuilder()
            .setCustomId('id-input')
            .setLabel("Station ID (unique identifier)")
            .setStyle(TextInputStyle.Short)
            .setRequired(true);
        
        const nameInput = new TextInputBuilder()
            .setCustomId('name-input')
            .setLabel("Station Name")
            .setStyle(TextInputStyle.Short)
            .setRequired(true);
        
        modal.addComponents(
            new ActionRowBuilder().addComponents(stationIdInput),
            new ActionRowBuilder().addComponents(nameInput)
        );
        
        await interaction.showModal(modal);
    }

    async handleDeleteStation(interaction, lineId, stationId) {
        if (!lineId || !stationId) {
            return this.promptStationSelection(interaction, 'delete', lineId);
        }
        
        const station = await this.framework.getStation(lineId, stationId);
        if (!station) {
            throw new Error(`Station ${stationId} on line ${lineId} not found`);
        }
        
        const confirmEmbed = this.createEmbed(
            'warning',
            `⚠️ Confirm deletion of ${station.basicInfo.name} (${lineId.toUpperCase()})`,
            'This action cannot be undone'
        );
        
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`metro-confirm-delete_${lineId}_${stationId}`)
                .setLabel('CONFIRM DELETE')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('metro-cancel-action')
                .setLabel('Cancel')
                .setStyle(ButtonStyle.Secondary)
        );
        
        await interaction.editReply({ embeds: [confirmEmbed], components: [row] });
    }

    async handleListStations(interaction, lineId) {
        const allStations = Object.entries(this.framework.loadedData.stations)
            .filter(([key, station]) => 
                (!lineId || key.startsWith(lineId.toLowerCase())) && 
                !station._deleted
            )
            .map(([key, station]) => {
                const [line, id] = key.split(':');
                return {
                    line,
                    id,
                    name: station.basicInfo.name,
                    status: station.status.description
                };
            });
        
        if (allStations.length === 0) {
            return interaction.editReply({
                embeds: [this.createEmbed(
                    'warning',
                    lineId ? `No stations found on line ${lineId.toUpperCase()}` : 'No stations found in the network'
                )],
                ephemeral: true
            });
        }
        
        const embed = this.createEmbed(
            'info',
            lineId ? `Stations on Line ${lineId.toUpperCase()}` : 'All Stations in Network'
        ).setFooter({ text: `Total: ${allStations.length} stations` });
        
        if (!lineId) {
            const lines = {};
            allStations.forEach(station => {
                if (!lines[station.line]) lines[station.line] = [];
                lines[station.line].push(station);
            });
            
            for (const [line, stations] of Object.entries(lines)) {
                embed.addFields({
                    name: `Line ${line.toUpperCase()} (${stations.length})`,
                    value: stations.map(s => `• ${s.name} (\`${s.id}\`) - ${s.status}`).join('\n'),
                    inline: false
                });
            }
        } else {
            embed.setDescription(allStations.map(s => `• ${s.name} (\`${s.id}\`) - ${s.status}`).join('\n'));
        }
        
        await interaction.editReply({ embeds: [embed] });
    }

    async handleVerifyData(interaction) {
        const issues = [];
        const stationCount = Object.keys(this.framework.loadedData.stations).length;
        
        for (const [key, station] of Object.entries(this.framework.loadedData.stations)) {
            if (station._deleted) continue;
            
            if (!station.basicInfo?.name) {
                issues.push(`Missing name for station ${key}`);
            }
            
            if (!station.status?.description) {
                issues.push(`Missing status description for station ${key}`);
            }
            
            if (!station.basicInfo?.code) {
                issues.push(`Missing code for station ${key}`);
            }
        }
        
        const embed = this.createEmbed(
            issues.length ? 'warning' : 'success',
            issues.length ? '⚠️ Data Issues Found' : '✅ Data Verified'
        ).addFields(
            { name: 'Stations Checked', value: stationCount.toString(), inline: true },
            { name: 'Issues Found', value: issues.length.toString(), inline: true }
        );
        
        if (issues.length > 0) {
            embed.addFields({
                name: 'Sample Issues',
                value: issues.slice(0, 5).join('\n') + (issues.length > 5 ? `\n...and ${issues.length - 5} more` : '')
            });
        }
        
        await interaction.editReply({ embeds: [embed] });
    }

    async handleExportData(interaction) {
        const exportData = {
            timestamp: new Date().toISOString(),
            stations: Object.entries(this.framework.loadedData.stations)
                .filter(([_, station]) => !station._deleted)
                .reduce((acc, [key, station]) => {
                    acc[key] = station;
                    return acc;
                }, {})
        };
        
        const buffer = Buffer.from(JSON.stringify(exportData, null, 2));
        
        await interaction.editReply({
            embeds: [this.createEmbed(
                'success',
                'Data Export Complete',
                `Exported ${Object.keys(exportData.stations).length} stations`
            )],
            files: [{
                attachment: buffer,
                name: `metro-export-${new Date().toISOString().split('T')[0]}.json`
            }]
        });
    }

    async promptStationSelection(interaction, action, lineFilter = null) {
        const options = Object.entries(this.framework.loadedData.stations)
            .filter(([key, station]) => 
                (!lineFilter || key.startsWith(lineFilter.toLowerCase())) && 
                !station._deleted
            )
            .map(([key, station]) => {
                const [line, id] = key.split(':');
                return {
                    label: station.basicInfo.name,
                    description: `Line ${line.toUpperCase()} (${id})`,
                    value: key
                };
            });
        
        if (options.length === 0) {
            return interaction.editReply({
                embeds: [this.createEmbed(
                    'warning',
                    lineFilter ? `No stations found on line ${lineFilter.toUpperCase()}` : 'No stations available'
                )],
                ephemeral: true
            });
        }
        
        const selectMenu = selectMenus.get('metro-station-select');
        const customId = selectMenu.generateCustomId({ action });
        
        const select = new StringSelectMenuBuilder()
            .setCustomId(customId)
            .setPlaceholder(`Select station to ${action}`)
            .addOptions(options.slice(0, 25));
        
        await interaction.editReply({
            content: `Select a station to ${action}:`,
            components: [new ActionRowBuilder().addComponents(select)]
        });
        
        interactionStore.set(customId, { action, lineFilter }, DATA_EXPIRY);
    }
}

// Command export
module.exports = {
    parentCommand: 'owner',
    
    data: (subcommand) => subcommand
        .setName('metrodata')
        .setDescription('Complete metro data management system')
        .addStringOption(option =>
            option.setName('action')
                .setDescription('Action to perform')
                .setRequired(true)
                .addChoices(
                    { name: 'View station', value: 'view-station' },
                    { name: 'Edit station', value: 'edit-station' },
                    { name: 'Create station', value: 'create-station' },
                    { name: 'Delete station', value: 'delete-station' },
                    { name: 'List all stations', value: 'list-stations' },
                    { name: 'Verify data integrity', value: 'verify-data' },
                    { name: 'Export all data', value: 'export-data' }
                ))
        .addStringOption(option =>
            option.setName('line-id')
                .setDescription('Line identifier')
                .setRequired(false)
                .addChoices(
                    { name: 'Line 1', value: 'l1' },
                    { name: 'Line 2', value: 'l2' },
                    { name: 'Line 3', value: 'l3' },
                    { name: 'Line 4', value: 'l4' },
                    { name: 'Line 4A', value: 'l4a' },
                    { name: 'Line 5', value: 'l5' },
                    { name: 'Line 6', value: 'l6' }
                ))
        .addStringOption(option =>
            option.setName('station-id')
                .setDescription('Station identifier')
                .setRequired(false)),
    
    async execute(interaction) {
        // Initialize components if not already registered
        if (!buttons.get('metro-view-btn')) {
            MetroDataManager.registerComponents();
        }
        
        const manager = new MetroDataManager();
        await manager.handleCommand(interaction);
    }
};