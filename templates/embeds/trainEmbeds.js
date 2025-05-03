const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const styles = require('../../config/metro/styles.json');
const metroConfig = require('../../config/metro/metroConfig');

module.exports = {
    createTrainOverview: (trainData, model, cacheId) => {
        const embed = new EmbedBuilder()
            .setTitle(`${metroConfig.emoji.tren} Tren ${model.toUpperCase()}`)
            .setColor(styles.lineColors[trainData.line] || styles.defaultTheme.primaryColor)
            .setThumbnail(trainData.images?.exterior || metroConfig.defaultTrainImage)
            .addFields(
                { name: '🏭 Fabricante', value: trainData.manufacturer || 'No especificado', inline: true },
                { name: '📅 Año', value: trainData.year || 'No especificado', inline: true },
                { name: '🚈 Líneas', value: trainData.lines.join(', ') || 'No especificado', inline: false },
                { name: '⚡ Velocidad', value: trainData.specs.maxSpeed || 'No especificado', inline: true },
                { name: '🔌 Potencia', value: trainData.specs.power || 'No especificado', inline: true }
            );

        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`train_tech_${cacheId}`)
                .setLabel('Especificaciones')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`train_perf_${cacheId}`)
                .setLabel('Rendimiento')
                .setStyle(ButtonStyle.Secondary)
        );

        return { embed, buttons };
    },

    createTechSpecsEmbed: (trainData, model, cacheId) => {
        const embed = new EmbedBuilder()
            .setTitle(`📐 ${model.toUpperCase()} - Especificaciones Técnicas`)
            .setColor(styles.defaultTheme.infoColor)
            .addFields(
                { name: '🛞 Tipo', value: trainData.specs.type || 'No especificado', inline: true },
                { name: '📏 Dimensiones', value: formatDimensions(trainData.specs.dimensions), inline: true },
                { name: '⚖️ Peso', value: formatWeight(trainData.specs.weight), inline: true },
                { name: '🔌 Motores', value: trainData.specs.motors || 'No especificado', inline: true },
                { name: '⚡ Alimentación', value: trainData.specs.powerSupply || 'No especificado', inline: true },
                { name: '🛑 Frenos', value: trainData.specs.brakes?.join(', ') || 'No especificado', inline: false }
            );

        return { 
            embed, 
            buttons: createNavigationButtons(cacheId) 
        };
    },

    createPerformanceEmbed: (trainData, model, cacheId) => {
        const embed = new EmbedBuilder()
            .setTitle(`⚡ ${model.toUpperCase()} - Rendimiento`)
            .setColor(styles.defaultTheme.successColor)
            .addFields(
                { name: '🚄 Velocidad Máx', value: trainData.specs.maxSpeed || 'No especificado', inline: true },
                { name: '🔋 Potencia', value: trainData.specs.power || 'No especificado', inline: true },
                { name: '🔄 Transmisión', value: trainData.specs.transmission || 'No especificado', inline: true },
                { name: '🧍 Capacidad', value: formatCapacity(trainData.capacity), inline: true },
                { name: '⏱️ Años Servicio', value: calculateServiceYears(trainData.year), inline: true }
            );

        return { 
            embed, 
            buttons: createNavigationButtons(cacheId) 
        };
    }
};

// Helper functions
function formatDimensions(dim) {
    if (!dim) return 'No disponible';
    return `Largo: ${dim.length || '?'}\nAncho: ${dim.width || '?'}\nAlto: ${dim.height || '?'}`;
}

function formatWeight(weight) {
    if (!weight) return 'No disponible';
    return typeof weight === 'object' 
        ? `${weight.empty} (vacío)\n${weight.loaded} (cargado)`
        : weight;
}

function formatCapacity(cap) {
    if (!cap) return 'No disponible';
    return typeof cap === 'object'
        ? `${cap.seats} asientos\n${cap.standing} de pie`
        : `${cap} pasajeros`;
}

function calculateServiceYears(year) {
    if (!year) return 'No disponible';
    const currentYear = new Date().getFullYear();
    return `${currentYear - parseInt(year)} años`;
}

function createNavigationButtons(cacheId) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`train_main_${cacheId}`)
            .setLabel('Volver')
            .setStyle(ButtonStyle.Danger)
    );
}