/*const { sendMetroUpdate } = require('../events/metroUpdates');
const { enableTestMode, disableTestMode } = require('../statusHelpers/changeDetector');

module.exports = {
    name: 'testupdate',
    description: 'Test metro status updates',
    usage: 'm!testupdate <scenario>',
    async execute(message, args) {
        if (!message.member.permissions.has('ADMINISTRATOR')) {
            return message.reply('❌ Solo administradores pueden ejecutar pruebas.');
        }

        if (!args.length) {
            return message.reply('❌ Especifica un escenario: normal, closed, partial, extended');
        }

        const scenario = args[0].toLowerCase();
        let testData;

        switch (scenario) {
            case 'closed':
                testData = {
                    networkStatus: 0,
                    hasEstado0: true,
                    messages: {
                        'Cierre por horario': { lines: [], stations: {} }
                    }
                };
                break;
                
            case 'partial':
                testData = {
                    networkStatus: 3,
                    hasEstado0: false,
                    messages: {
                        'Servicio reducido L1': {
                            lines: [{ line: 'l1', estado: 3 }],
                            stations: { '1': ['Estación Central'] }
                        }
                    }
                };
                break;
                
            case 'extended':
                testData = {
                    networkStatus: 5,
                    hasEstado0: false,
                    messages: {
                        'Horario extendido': {
                            lines: [{ line: 'l1', estado: 5 }],
                            stations: {}
                        }
                    }
                };
                break;
                
            default: // normal
                testData = {
                    networkStatus: 1,
                    hasEstado0: false,
                    messages: {}
                };
        }

        try {
            enableTestMode(testData);
            await sendMetroUpdate(message.client, { 
                forceSend: true,
                messageOptions: { includeDetails: true }
            });
            await message.reply(`✅ Escenario **${scenario}** probado correctamente`);
        } catch (error) {
            await message.reply(`❌ Error en prueba: ${error.message}`);
        } finally {
            disableTestMode();
        }
    }
};*/