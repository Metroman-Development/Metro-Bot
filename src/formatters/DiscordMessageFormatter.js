const { ButtonStyle, ActionRowBuilder, ButtonBuilder, EmbedBuilder, StringSelectMenuBuilder } = require('discord.js');
const cacheManager = require('../utils/cacheManager');
const metroConfig = require('../config/metro/metroConfig');
const { createErrorEmbed, createEmbed } = require('../utils/embedFactory');
const { getLineColor, getLineImage } = require('../utils/metroUtils');
const { normalizeStationData } = require('../utils/stationUtils');

const CUSTOM_ID_PREFIX = 'stationInfo';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

const tabs = {
    main: {
        label: 'ℹ️ Información',
        style: ButtonStyle.Primary,
        emoji: 'ℹ️'
    },
    surroundings: {
        label: '🗺️ Alrededores',
        style: ButtonStyle.Secondary,
        emoji: '🗺️'
    },
    transfers: {
        label: '🔄 Combinaciones',
        style: ButtonStyle.Success,
        emoji: '🔄'
    },
    accessibility: {
        label: '♿ Accesibilidad',
        style: ButtonStyle.Secondary,
        emoji: '♿',
        isToggle: true
    },
    // Accessibility sub-tabs
    acc_summary: {
        label: '📋 Resumen',
        style: ButtonStyle.Secondary,
        emoji: '📋',
        parent: 'accessibility'
    },
    acc_elevators: {
        label: '🛗 Ascensores',
        style: ButtonStyle.Secondary,
        emoji: '🛗',
        parent: 'accessibility'
    },
    acc_escalators: {
        label: '🪜 Escaleras',
        style: ButtonStyle.Secondary,
        emoji: '🪜',
        parent: 'accessibility'
    },
    acc_accesses: {
        label: '🚪 Accesos',
        style: ButtonStyle.Secondary,
        emoji: '🚪',
        parent: 'accessibility'
    }
};


class DiscordMessageFormatter {
    _getCacheKey(stationId, userId) {
        return `${CUSTOM_ID_PREFIX}:${userId}:${stationId}`;
    }

    async _createErrorMessage(message) {
        const errorEmbed = await createErrorEmbed(message);
        return {
            embeds: [errorEmbed],
            components: []
        };
    }

    _enrichStationData(station) {
        let transferLines = [];
        let connections = station.connections;
        if (typeof connections === 'string') {
            try {
                connections = JSON.parse(connections);
            } catch (e) {
                connections = null;
            }
        }

        if (Array.isArray(connections)) {
            transferLines.push(...connections);
        }

        if (station.transfer) {
            transferLines.push(station.transfer);
        }

        const uniqueTransferLines = [...new Set(transferLines)];

        return {
            ...station,
            id: station.id,
            displayName: station.displayName || 'Unknown Station',
            line: station.line || 'L0',
            transferLines: uniqueTransferLines,
            color: station.color || getLineColor(station.line),
            image: station.image || getLineImage(station.line)
        };
    }

    _findTransferStation(currentStation, line, metroData) {
        if (!line || !currentStation?.displayName) return null;

        const baseName = currentStation.displayName.replace(/\s(L\d+[a-z]?)$/i, '').trim();
        const transferDisplayName = `${baseName} ${line.toUpperCase()}`;

        return Object.values(metroData.stations || {})
            .find(s => s?.displayName === transferDisplayName);
    }

    _getTransferStationId(currentStation, metroData) {
        if (!currentStation?.transferLines?.length) return null;
        const transferStation = this._findTransferStation(currentStation, currentStation.transferLines[0], metroData);
        return transferStation?.id;
    }

    _createActionRows(cacheData) {
        const { currentTab, station } = cacheData;
        const mainButtons = new ActionRowBuilder();
        const accessibilityButtons = new ActionRowBuilder();

        // Main tabs
        for (const [key, tabInfo] of Object.entries(tabs)) {
            if (!tabInfo.parent) {
                const button = new ButtonBuilder()
                    .setCustomId(`${CUSTOM_ID_PREFIX}:${station.id}:${key}`)
                    .setLabel(tabInfo.label)
                    .setStyle(key === currentTab ? ButtonStyle.Primary : ButtonStyle.Secondary)
                    .setDisabled(key === currentTab);
                mainButtons.addComponents(button);
            }
        }

        const components = [mainButtons];

        // Accessibility dropdown
        if (currentTab.startsWith('acc_')) {
            const accessibilityOptions = Object.entries(tabs)
                .filter(([_, tabInfo]) => tabInfo.parent === 'accessibility')
                .map(([key, tabInfo]) => ({
                    label: tabInfo.label,
                    value: `${CUSTOM_ID_PREFIX}:${station.id}:${key}`,
                    default: key === currentTab
                }));

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId(`${CUSTOM_ID_PREFIX}:${station.id}:accessibility_select`)
                .setPlaceholder('Selecciona un detalle de accesibilidad')
                .addOptions(accessibilityOptions);
            accessibilityButtons.addComponents(selectMenu);
            components.push(accessibilityButtons);
        }

        return components;
    }

    async _createStationMessage(cacheData, userId) {
        if (!cacheData?.station) {
            return this._createErrorMessage('Station data unavailable');
        }

        try {
            const embed = await this._createEmbedForTab(cacheData);
            const components = this._createActionRows(cacheData);

            return {
                embeds: [embed],
                components: components,
                fetchReply: true
            };
        } catch (error) {
            console.error('[stationInfoButton] Message creation failed:', error);
            return this._createErrorMessage('Error generating station info');
        }
    }

    async _createMainEmbed(station, metroData) {
        return createEmbed('stationMain', { station, metroData });
    }

    async _createSurroundingsEmbed(station) {
        const embed = new EmbedBuilder()
            .setTitle(`🗺️ Alrededores de ${station.name}`)
            .setColor(station.color)
            .setImage(station.image_url);

        // Add more details about surroundings if available
        return embed;
    }

    async _createAccessibilityEmbed(station, tab) {
        const embed = new EmbedBuilder()
            .setTitle(`♿ Accesibilidad en ${station.name}`)
            .setColor(station.color);

        if (!station.accessibility || station.accessibility.length === 0) {
            embed.setDescription('No hay información de accesibilidad disponible para esta estación.');
            return embed;
        }

        const accessibility = station.accessibility;
        const operationalEmoji = metroConfig.accessibility.estado.ope;
        const notOperationalEmoji = metroConfig.accessibility.estado.fes;

        const summaryLines = [];
        const elevators = accessibility.filter(item => item.tipo === 'ascensor');
        const escalators = accessibility.filter(item => item.tipo === 'escalera');
        const other = accessibility.filter(item => item.tipo !== 'ascensor' && item.tipo !== 'escalera');

        const nonOperationalElevators = elevators.filter(item => item.estado !== 1);
        const nonOperationalEscalators = escalators.filter(item => item.estado !== 1);
        const nonOperationalOther = other.filter(item => item.estado !== 1);

        if (nonOperationalElevators.length > 0) {
            summaryLines.push(`**${nonOperationalElevators.length}** ascensores con problemas.`);
        }
        if (nonOperationalEscalators.length > 0) {
            summaryLines.push(`**${nonOperationalEscalators.length}** escaleras con problemas.`);
        }
        if (nonOperationalOther.length > 0) {
            summaryLines.push(`**${nonOperationalOther.length}** otros equipos con problemas.`);
        }

        if (summaryLines.length === 0) {
            embed.setDescription('✅ Todos los equipos de accesibilidad se encuentran operativos.');
        } else {
            embed.setDescription('⚠️ Se reportan las siguientes incidencias:\n' + summaryLines.join('\n'));
        }

        const addFieldsFor = (items, typeName) => {
            if (items.length === 0) {
                embed.addFields({ name: typeName, value: `✅ No se reportan incidencias en ${typeName.toLowerCase()}.` });
                return;
            }

            let description = '';
            const fieldChunks = [];

            for (const item of items) {
                const statusEmoji = item.estado === 1 ? operationalEmoji : notOperationalEmoji;
                const line = `${statusEmoji} ${item.texto}\n`;
                if (description.length + line.length > 1024) {
                    fieldChunks.push(description);
                    description = '';
                }
                description += line;
            }
            fieldChunks.push(description);

            fieldChunks.forEach((chunk, index) => {
                embed.addFields({
                    name: index === 0 ? typeName : '​', // Zero-width space for subsequent fields
                    value: chunk
                });
            });
        };

        switch (tab) {
            case 'acc_elevators':
                embed.setTitle(`🛗 Ascensores en ${station.name}`);
                addFieldsFor(elevators, 'Ascensores');
                break;
            case 'acc_escalators':
                embed.setTitle(`🪜 Escaleras en ${station.name}`);
                addFieldsFor(escalators, 'Escaleras');
                break;
            case 'acc_accesses':
                 embed.setTitle(`🚪 Accesos en ${station.name}`);
                 // For now, there is no data for this tab.
                 embed.setDescription('No hay información sobre otros tipos de acceso por el momento.');
                break;
            case 'accessibility':
            case 'acc_summary':
            default:
                // The summary is already set at the beginning of the function.
                break;
        }

        return embed;
    }


    async _createTransfersEmbed(station) {
        const embed = new EmbedBuilder()
            .setTitle(`🔄 Combinaciones en ${station.displayName}`)
            .setColor(station.color);

        const normalizedStation = normalizeStationData(station);
        const { lines, other, bikes } = normalizedStation.connections;

        if (lines && lines.length > 0) {
            const value = lines.map(l => `${metroConfig.linesEmojis[l.toLowerCase()] || `Línea ${l}`}`).join('\n');
            embed.addFields({ name: 'Líneas de Metro', value: value, inline: false });
        }

        const normalizedConnectionEmojis = Object.keys(metroConfig.connectionEmojis || {}).reduce((acc, key) => {
            const normalizedKey = key.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            acc[normalizedKey] = metroConfig.connectionEmojis[key];
            return acc;
        }, {});

        if (other && other.length > 0) {
            const value = other.map(t => `${normalizedConnectionEmojis[t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")] || '🚌'} ${t}`).join('\n');
            embed.addFields({ name: 'Otros Transportes', value: value, inline: false });
        }

        if (bikes && bikes.length > 0) {
            const value = bikes.map(b => `${normalizedConnectionEmojis[b.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")] || '🚲'} ${b}`).join('\n');
            embed.addFields({ name: 'Bicicletas', value: value, inline: false });
        }

        if ((!lines || lines.length === 0) && (!other || other.length === 0) && (!bikes || bikes.length === 0)) {
            embed.setDescription('No hay información de combinaciones para esta estación.');
        }

        return embed;
    }

    async _createEmbedForTab(cacheData) {
        const { station, metroData, currentTab } = cacheData;
        switch (currentTab) {
            case 'main':
                return this._createMainEmbed(station, metroData);
            case 'surroundings':
                return this._createSurroundingsEmbed(station);
            case 'transfers':
                return this._createTransfersEmbed(station);
            case 'accessibility':
            case 'acc_summary':
            case 'acc_elevators':
            case 'acc_escalators':
            case 'acc_accesses':
                return this._createAccessibilityEmbed(station, currentTab);
            default:
                return this._createMainEmbed(station, metroData);
        }
    }

    async formatStationInfo(station, metroInfoProvider, userId) {
        try {
            if (!station?.id) throw new Error('Invalid station data');

            const cacheKey = this._getCacheKey(station.id, userId);
            const metroData = metroInfoProvider.getFullData();
            const enrichedStation = this._enrichStationData(station);

            const cacheData = {
                station: enrichedStation,
                metroData: metroData,
                currentTab: 'main',
                timestamp: Date.now()
            };

            cacheManager.set(cacheKey, cacheData, CACHE_DURATION);
            return await this._createStationMessage(cacheData, userId);
        } catch (error) {
            console.error('[stationInfoButton] Build failed:', error);
            return await this._createErrorMessage('Error loading station data');
        }
    }

    _getStatusMapping(code) {
        if (!metroConfig.statusTypes) {
            console.error("metroConfig.statusTypes is not initialized.");
            // Return a default value to avoid a crash
            return { emoji: '❓', message: 'Desconocido' };
        }
        const codeStr = (code || '1').toString();
        return metroConfig.statusTypes[codeStr] || metroConfig.statusTypes['1'];
    }

    _getColorForStatus(statusCode) {
        const code = parseInt(statusCode.toString());
        switch (code) {
            case 0: return '#95a5a6';
            case 1: return '#2ecc71';
            case 2: return '#e74c3c';
            case 3: return '#f39c12';
            case 4: return '#e67e22';
            case 5: return '#4CAF50';
            default: return '#95a5a6';
        }
    }

    formatStationStatus(station) {
        try {
            if (!station || !station.status_data) {
                console.error('formatStationStatus: station or station.status_data is undefined', { station_id: station?.id });
                return this._createErrorMessage(`Error al obtener el estado de la estación ${station?.name || 'desconocida'}`);
            }
            const enrichedStation = this._enrichStationData(station);
            const statusStyle = this._getStatusMapping(enrichedStation.status_data.js_code);
            const color = this._getColorForStatus(enrichedStation.status_data.js_code);

            const embed = new EmbedBuilder()
                .setTitle(`${metroConfig.linesEmojis[enrichedStation.line_id]} Estación ${enrichedStation.name || 'Desconocida'}`)
                .setColor(color)
                .setDescription(`**Estado:** ${statusStyle.emoji} ${statusStyle.message}`);

            let info = enrichedStation.status_data.status_message || 'No hay información adicional.';

            if (enrichedStation.transferLines && enrichedStation.transferLines.length > 0) {
                info += `\n**Combinación:** Con Línea(s) ${enrichedStation.transferLines.join(', ')}`;
            }
            embed.addFields({ name: '📌 Información', value: info });

            embed.setFooter({ text: `Última actualización: ${new Date(enrichedStation.last_renovation_date).toLocaleString()}` });

            return { embeds: [embed] };
        } catch (error) {
            console.error('STATION_EMBED_FAILED', { station: station?.id, error: error.message, stack: error.stack });
            return this._createErrorMessage(`Error al mostrar estación ${station?.name || 'desconocida'}`);
        }
    }
}

module.exports = DiscordMessageFormatter;
