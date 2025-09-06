const { expect } = require('chai');
const sinon = require('sinon');
const pingCommand = require('../src/bot/telegram/commands/ping');
const versionCommand = require('../src/bot/telegram/commands/version');
const serverinfoCommand = require('../src/bot/telegram/commands/serverinfo');
const whoisCommand = require('../src/bot/telegram/commands/whois');
const buscarCommand = require('../src/bot/telegram/commands/buscar');
const calendarioCommand = require('../src/bot/telegram/commands/calendario');
const expresoCommand = require('../src/bot/telegram/commands/expreso');
const servicioCommand = require('../src/bot/telegram/commands/servicio');
const estacionCommand = require('../src/bot/telegram/commands/estacion');
const intermodalCommand = require('../src/bot/telegram/commands/intermodal');
const lineaCommand = require('../src/bot/telegram/commands/linea');
const metroCommand = require('../src/bot/telegram/commands/metro');
const tarifaCommand = require('../src/bot/telegram/commands/tarifa');
const ayudaCommand = require('../src/bot/telegram/commands/ayuda');

const { MetroInfoProvider } = require('../src/utils/MetroInfoProvider');
const DatabaseManager = require('../src/core/database/DatabaseManager');

describe('Telegram Commands', () => {
  let ctx;
  let metroInfoProviderStub;
  let dbStub;

  beforeEach(() => {
    ctx = {
      reply: sinon.stub(),
      replyWithMarkdown: sinon.stub(),
      replyWithPhoto: sinon.stub(),
      telegram: {
        editMessageText: sinon.stub(),
        getUserProfilePhotos: sinon.stub().resolves({ total_count: 0 }),
      },
      message: { text: '' },
      from: {
        id: 123,
        first_name: 'Test',
        last_name: 'User',
        username: 'testuser',
        language_code: 'en',
      },
      chat: {
        id: 456,
        title: 'Test Chat',
        type: 'group',
      },
    };

    const fullData = {
      stations: {
        'L1-BAQ': { id: 'L1-BAQ', displayName: 'Baquedano', line: { id: 'l1' }, commerce: 'tienda' },
      },
      intermodal: {
        stations: { '1': { id: '1', name: 'La Cisterna', location: 'LC', commune: 'La Cisterna', services: 'buses' } },
        buses: [],
      },
      system: {
        name: 'Metro de Santiago',
        system: 'Metro',
        inauguration: '1975',
        technicalCharacteristics: {
          length: '140 km',
          stations: '136',
          electrification: 'DC',
          maxSpeed: '80 km/h',
        },
        operation: {
          lines: '7',
          fleet: '345',
          passengers: 2800000,
          averageSpeed: '30 km/h',
        },
      },
      network_status: {
        status: 'Operativa',
        summary: { es: { resumen: 'Todo bien' } },
        timestamp: new Date().toISOString(),
      },
    };

    metroInfoProviderStub = sinon.stub(MetroInfoProvider, 'getInstance').returns({
      getFullData: () => fullData,
      getLineData: () => ({ nombre: 'Línea 1', color: 'rojo', mensaje_app: 'Operativa', data: { 'N° estaciones': 27, Longitud: '20 km', Comunas: ['Providencia'] } }),
      getExpressData: () => ({ roja: ['a'], verde: ['b'], comun: ['c'] }),
      getStationById: () => fullData.stations['L1-BAQ'],
    });

    dbStub = sinon.stub(DatabaseManager, 'getInstance').resolves({
      getAccessibilityStatus: sinon.stub().resolves([]),
    });
  });

  afterEach(() => {
    sinon.restore();
  });

  it('ping command should reply with pong', async () => {
    ctx.reply.resolves({ message_id: 1 });
    await pingCommand.execute(ctx);
    expect(ctx.reply.calledWith('🏓 Pong!')).to.be.true;
    expect(ctx.telegram.editMessageText.calledOnce).to.be.true;
  });

  it('version command should reply with the version', async () => {
    await versionCommand.execute(ctx);
    expect(ctx.reply.calledOnce).to.be.true;
  });

  it('serverinfo command should reply with chat info', async () => {
    await serverinfoCommand.execute(ctx);
    expect(ctx.replyWithMarkdown.calledOnce).to.be.true;
  });

  it('whois command should reply with user info', async () => {
    await whoisCommand.execute(ctx);
    expect(ctx.replyWithMarkdown.calledOnce).to.be.true;
  });

  it('buscar command should reply with search results', async () => {
    ctx.message.text = '/buscar comercio tienda';
    await buscarCommand.execute(ctx);
    expect(ctx.replyWithMarkdown.calledOnce).to.be.true;
  });

  it('calendario command should reply with the weekly schedule', async () => {
    await calendarioCommand.execute(ctx);
    expect(ctx.replyWithMarkdown.calledOnce).to.be.true;
  });

  it('expreso command should reply with express route info', async () => {
    ctx.message.text = '/expreso l2';
    await expresoCommand.execute(ctx);
    expect(ctx.replyWithMarkdown.calledOnce).to.be.true;
  });

  it('servicio command should reply with service status', async () => {
    await servicioCommand.execute(ctx);
    expect(ctx.replyWithMarkdown.calledOnce).to.be.true;
  });

  it('estacion command should reply with station info', async () => {
    ctx.message.text = '/estacion baquedano';
    await estacionCommand.execute(ctx);
    expect(ctx.replyWithMarkdown.calledOnce).to.be.true;
  });

  it('intermodal command should reply with intermodal station info', async () => {
    ctx.message.text = '/intermodal la cisterna';
    await intermodalCommand.execute(ctx);
    expect(ctx.replyWithMarkdown.calledOnce).to.be.true;
  });

  it('linea command should reply with line info', async () => {
    ctx.message.text = '/linea l1';
    await lineaCommand.execute(ctx);
    expect(ctx.replyWithMarkdown.calledOnce).to.be.true;
  });

  it('metro command should reply with metro system info', async () => {
    await metroCommand.execute(ctx);
    expect(ctx.replyWithMarkdown.calledOnce).to.be.true;
  });

  it('tarifa command should reply with fare info', async () => {
    await tarifaCommand.execute(ctx);
    expect(ctx.replyWithMarkdown.calledOnce).to.be.true;
  });

  it('ayuda command should reply with help message', async () => {
    await ayudaCommand.execute(ctx);
    expect(ctx.reply.calledOnce).to.be.true;
  });
});
