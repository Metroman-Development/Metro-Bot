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
            await ctx.reply('❌ Error al obtener información de tarifas');
        }
    },

    registerActions(bot) {
        // Explicitly register each action handler with proper error handling
        const actions = {
            'fare_normal': 'normal',
            'fare_estudiante': 'estudiante',
            'fare_adulto_mayor': 'adulto_mayor',
            'fare_bip_adulto_mayor': 'bip_adulto_mayor',
            'fare_nos': 'nos',
            'fare_transantiago': 'transantiago',
            'fare_all': 'all'
        };

        Object.entries(actions).forEach(([action, fareType]) => {
            bot.action(action, async (ctx) => {
                try {
                    if (fareType === 'all') {
                        await this.showAllFares(ctx);
                    } else {
                        await this.showSpecificFare(ctx, fareType);
                    }
                } catch (error) {
                    console.error(`Error in ${action} handler:`, error);
                    try {
                        await ctx.answerCbQuery('❌ Error al procesar la solicitud');
                    } catch (err) {
                        console.error('Failed to answer callback query:', err);
                    }
                }
            });
        });
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

            let message = `💰 *Todas las Tarifas*\n\n`;
            message += `*Período Actual:* ${currentPeriod.name}\n`;
            message += `*Próximo Cambio:* ${nextTransition.time}\n\n`;
            
            for (const [name, amount] of Object.entries(fares)) {
                message += `*${name}:* $${amount}\n`;
            }

            // Recreate the keyboard to maintain navigation
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
            console.error('Error in showAllFares:', error);
            await ctx.answerCbQuery('❌ Error al mostrar tarifas');
            throw error; // Re-throw to be caught by the action handler
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
            
            let message = `${config.emoji} *${config.name}*\n`;
            message += `${config.description}\n\n`;
            
            if (isFlatFare) {
                message += `*Tarifa Única:* $${metroConfig.tarifario[config.keys[0]]}\n`;
            } else {
                message += `*Hora Punta:* $${metroConfig.tarifario[config.keys[0]]}\n`;
                message += `*Horario Normal:* $${metroConfig.tarifario[config.keys[1]]} ${currentPeriod.type === 'VALLE' ? '(ACTUAL)' : ''}\n`;
                message += `*Horario Bajo:* $${metroConfig.tarifario[config.keys[2]]}\n`;
            }

            message += `\n*Período Actual:* ${currentPeriod.name}\n`;
            message += `${TimeHelpers.formatTime(new Date())}`;

            // Recreate the keyboard to maintain navigation
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
            console.error(`Error in showSpecificFare for ${fareType}:`, error);
            await ctx.answerCbQuery('❌ Error al mostrar tarifa');
            throw error; // Re-throw to be caught by the action handler
        }
    }
};
