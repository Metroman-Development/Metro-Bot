const { Markup } = require('telegraf');
const metroConfig = require('../../config/metro/metroConfig');
const TimeHelpers = require('../../modules/chronos/timeHelpers');

module.exports = {
    command: 'tarifa',
    description: 'Consulta las tarifas del Metro con opciones interactivas',
    
    async execute(ctx) {
        try {
            const currentPeriod = TimeHelpers.getCurrentPeriod();
            
            const keyboard = Markup.inlineKeyboard([
                [
                    Markup.button.callback('🚇 Normal (BIP)', 'fare_normal'),
                    Markup.button.callback('🎓 Estudiante (TNE)', 'fare_estudiante')
                ],
                [
                    Markup.button.callback('👴 Adulto Mayor', 'fare_adulto_mayor'),
                    Markup.button.callback('👵 BIP Adulto Mayor', 'fare_bip_adulto_mayor')
                ],
                [
                    Markup.button.callback('🟢 NOS', 'fare_nos'),
                    Markup.button.callback('🚌 Red', 'fare_transantiago')
                ],
                [
                    Markup.button.callback('💰 Todas las Tarifas', 'fare_all')
                ]
            ]);

            await ctx.replyWithMarkdown(
                `💰 *Tarifas del Metro*\n\n` +
                `Período actual: *${currentPeriod.name}*\n` +
                `${TimeHelpers.formatForEmbed()}`,
                keyboard
            );
        } catch (error) {
            console.error('Error en comando /tarifa:', error);
            ctx.reply('❌ Error al obtener información de tarifas');
        }
    },

    registerActions(bot) {
        // Handle all fare type buttons
        bot.action('fare_normal', async (ctx) => this.showSpecificFare(ctx, 'normal'));
        bot.action('fare_estudiante', async (ctx) => this.showSpecificFare(ctx, 'estudiante'));
        bot.action('fare_adulto_mayor', async (ctx) => this.showSpecificFare(ctx, 'adulto_mayor'));
        bot.action('fare_bip_adulto_mayor', async (ctx) => this.showSpecificFare(ctx, 'bip_adulto_mayor'));
        bot.action('fare_nos', async (ctx) => this.showSpecificFare(ctx, 'nos'));
        bot.action('fare_transantiago', async (ctx) => this.showSpecificFare(ctx, 'transantiago'));
        bot.action('fare_all', async (ctx) => this.showAllFares(ctx));
    },

    async showAllFares(ctx) {
        try {
            const currentPeriod = TimeHelpers.getCurrentPeriod();
            const nextTransition = TimeHelpers.getNextTransition();
            
            const fares = {
                'Normal (BIP)': metroConfig.tarifario[`t_metro_${currentPeriod.type.toLowerCase()}`],
                'Estudiante (TNE)': metroConfig.tarifario[`t_estudiante_${currentPeriod.type.toLowerCase()}`],
                'Adulto Mayor': metroConfig.tarifario[`t_adulto_${currentPeriod.type.toLowerCase()}`],
                'BIP Adulto Mayor': metroConfig.tarifario[`t_adultobip_${currentPeriod.type.toLowerCase()}`],
                'NOS': metroConfig.tarifario[`t_nos_${currentPeriod.type.toLowerCase()}`],
                'Red': metroConfig.tarifario['t_transantiago']
            };

            let message = `💰 *Todas las Tarifas*\n\n` +
                         `*Período Actual:* ${currentPeriod.name}\n` +
                         `*Próximo Cambio:* ${nextTransition.time}\n\n` +
                         Object.entries(fares).map(([name, amount]) => 
                             `*${name}:* $${amount}`
                         ).join('\n');

            // Keep the original keyboard
            const keyboard = Markup.inlineKeyboard([
                [
                    Markup.button.callback('🚇 Normal (BIP)', 'fare_normal'),
                    Markup.button.callback('🎓 Estudiante (TNE)', 'fare_estudiante')
                ],
                [
                    Markup.button.callback('👴 Adulto Mayor', 'fare_adulto_mayor'),
                    Markup.button.callback('👵 BIP Adulto Mayor', 'fare_bip_adulto_mayor')
                ],
                [
                    Markup.button.callback('🟢 NOS', 'fare_nos'),
                    Markup.button.callback('🚌 Red', 'fare_transantiago')
                ],
                [
                    Markup.button.callback('💰 Todas las Tarifas', 'fare_all')
                ]
            ]);

            await ctx.editMessageText(message, { 
                parse_mode: 'Markdown',
                reply_markup: keyboard.reply_markup
            });
            await ctx.answerCbQuery();
        } catch (error) {
            console.error('Error showing all fares:', error);
            await ctx.answerCbQuery('❌ Error al mostrar tarifas');
        }
    },

    async showSpecificFare(ctx, fareType) {
        try {
            const fareConfig = {
                'normal': { 
                    keys: ['t_metro_punta', 't_metro_valle', 't_metro_bajo'], 
                    name: 'Normal (BIP)',
                    emoji: '🚇',
                    description: 'Tarifa estándar para usuarios con tarjeta BIP'
                },
                'estudiante': { 
                    keys: ['t_estudiante_punta', 't_estudiante_valle', 't_estudiante_bajo'], 
                    name: 'Estudiante (TNE)',
                    emoji: '🎓',
                    description: 'Tarifa especial para estudiantes con TNE'
                },
                'adulto_mayor': { 
                    keys: ['t_adulto_punta', 't_adulto_valle', 't_adulto_bajo'], 
                    name: 'Adulto Mayor',
                    emoji: '👴',
                    description: 'Tarifa para adultos mayores (60+ años)'
                },
                'bip_adulto_mayor': { 
                    keys: ['t_adultobip_punta', 't_adultobip_valle', 't_adultobip_bajo'], 
                    name: 'BIP Adulto Mayor',
                    emoji: '👵',
                    description: 'Tarifa con tarjeta BIP para adultos mayores'
                },
                'nos': { 
                    keys: ['t_nos_punta', 't_nos_valle', 't_nos_bajo'], 
                    name: 'NOS',
                    emoji: '🟢',
                    description: 'Tarifa para usuarios del sistema NOS'
                },
                'transantiago': { 
                    keys: ['t_transantiago'], 
                    name: 'Red',
                    emoji: '🚌',
                    description: 'Tarifa integrada con buses Red'
                }
            };

            const config = fareConfig[fareType];
            const currentPeriod = TimeHelpers.getCurrentPeriod();
            const isFlatFare = fareType === 'transantiago';
            
            let message = `${config.emoji} *${config.name}*\n` +
                         `${config.description}\n\n` +
                         (isFlatFare 
                             ? `*Tarifa Única:* $${metroConfig.tarifario[config.keys[0]]}\n`
                             : `*Hora Punta:* $${metroConfig.tarifario[config.keys[0]]}\n` +
                               `*Horario Normal:* $${metroConfig.tarifario[config.keys[1]]} ${currentPeriod.type === 'VALLE' ? '(ACTUAL)' : ''}\n` +
                               `*Horario Bajo:* $${metroConfig.tarifario[config.keys[2]]}\n`) +
                         `\n*Período Actual:* ${currentPeriod.name}\n` +
                         `${TimeHelpers.formatTime(new Date())}`;

            // Keep the original keyboard
            const keyboard = Markup.inlineKeyboard([
                [
                    Markup.button.callback('🚇 Normal (BIP)', 'fare_normal'),
                    Markup.button.callback('🎓 Estudiante (TNE)', 'fare_estudiante')
                ],
                [
                    Markup.button.callback('👴 Adulto Mayor', 'fare_adulto_mayor'),
                    Markup.button.callback('👵 BIP Adulto Mayor', 'fare_bip_adulto_mayor')
                ],
                [
                    Markup.button.callback('🟢 NOS', 'fare_nos'),
                    Markup.button.callback('🚌 Red', 'fare_transantiago')
                ],
                [
                    Markup.button.callback('💰 Todas las Tarifas', 'fare_all')
                ]
            ]);

            await ctx.editMessageText(message, { 
                parse_mode: 'Markdown',
                reply_markup: keyboard.reply_markup
            });
            await ctx.answerCbQuery();
        } catch (error) {
            console.error(`Error showing ${fareType} fare:`, error);
            await ctx.answerCbQuery('❌ Error al mostrar tarifa');
        }
    }
};
