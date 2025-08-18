module.exports = {
    // Channel IDs
    updatesChannelId: '1347146518943105085', // For new updates/announcements
    welcomeChannelID: '899844115934642176',
    embedsChannelId: '1011417825862226023', // For permanent embeds
    announcementChannelId: '1347146518943105085',


    // Add this new section for connection emojis
    connectionEmojis: {
        // Transport connection emojis
        'Centropuerto': '🚌',  // Bus emoji
        'EFE': '🚆',           // Train emoji
        'EIM': '🔄',           // Intermodal station emoji
        'Terminal de Buses': '🚏', // Bus terminal emoji

        // Bike connection emojis
        'Línea Cero': '<:lineaCero:1362490490850771064>',
        'BiciMetro': '<:biciMetro:1362491413794652210>',
        'U Invertida': '<:uinvertida:1354232925511487651>'  // Lock emoji for bike racks
    },



    // Message IDs for the 8 embeds in the embedsChannel
    // In metroConfig.js
embedMessageIds: {
  overview: '1349131665842376725',

    // Overview embed message ID
    l1: '1349131668673269761',       // Line 1 embed message ID
    l2 : '1349131671517008037',       // Line 2
    l3
    : '1349131673249251431',       // Line 3
    l4 : '1349131675631616093',       // Line 4
    l4a : '1349131677753938056',      // Line 4A
    l5 : '1349131680429904024',       // Line 5
    l6 : '1349131682506211330',       // Line 6

},

    linesEmojis: {
        l1: '<:l1:1362493392084275331>',


        l2: '<:l2:1362493421817696597>',
        l3: '<:l3:1362493442499936477>',
        l4: '<:l4:1362493463072866537>',
        l4a: '<:l4a:1362493508643979435>',
        l5: '<:l5:1362493538914275390>',
        l6: '<:l6:1362493556500988065>',
        l7:'<:l7:1362492695494524928>',
        l8:'<:l8:1362492438974959616>',
        l9:'<:l9:1362492398487474407>',
        la:  '<:lA:1379150815696261120>'
    },

    statusTypes: {
        // Station Statuses
        '0': { name: 'fuera de horario', description: 'Estación Cerrada por Horario', isOperational: false, severity: 0, color: 0x00FF00, emoji: '🌙', discordem: '🌙', notification: false },
        '1': { name: 'abierta', description: 'Estación Abierta', isOperational: true, severity: 1, color: 0x00FF00, emoji: '✅', discordem: '✅', notification: false },
        '2': { name: 'combinación', description: 'Estación con combinación', isOperational: true, severity: 1, color: 0x0000FF, emoji: '🔄', discordem: '🔄', notification: false },
        '3': { name: 'accesos controlados', description: 'Accesos controlados', isOperational: false, severity: 2, color: 0xFFFF00, emoji: '⚠️', discordem: '⚠️', notification: true },
        '4': { name: 'accesos parciales', description: 'Accesos parciales', isOperational: false, severity: 2, color: 0xFFFF00, emoji: '⚠️', discordem: '⚠️', notification: true },
        '5': { name: 'cerrada', description: 'Estación Cerrada', isOperational: false, severity: 4, color: 0xFF0000, emoji: '❌', discordem: '❌', notification: true },
        '7': { name: 'contención', description: 'Contención', isOperational: false, severity: 3, color: 0xFFA500, emoji: '🛡️', discordem: '🛡️', notification: true },
        '8': { name: 'servicio extendido solo entrada', description: 'Servicio extendido solo entrada', isOperational: true, severity: 2, color: 0x0000FF, emoji: '➡️', discordem: '➡️', notification: true },
        '9': { name: 'servicio extendido solo salida', description: 'Servicio extendido solo salida', isOperational: true, severity: 2, color: 0x0000FF, emoji: '⬅️', discordem: '⬅️', notification: true },
        // Line Statuses
        '10': { name: 'operativa', description: 'Línea Operativa', isOperational: true, severity: 1, color: 0x00FF00, emoji: '✅', discordem: '✅', notification: false },
        '11': { name: 'lenta', description: 'Línea Lenta', isOperational: false, severity: 2, color: 0xFFFF00, emoji: '🕰️', discordem: '🕰️', notification: true },
        '12': { name: 'retrasos', description: 'Línea con Retrasos', isOperational: false, severity: 3, color: 0xFFA500, emoji: '⚠️', discordem: '⚠️', notification: true },
        '13': { name: 'parcial', description: 'Línea Parcialmente Operativa', isOperational: false, severity: 3, color: 0xFFA500, emoji: '⚠️', discordem: '⚠️', notification: true },
        '14': { name: 'suspendida', description: 'Línea Suspendida', isOperational: false, severity: 5, color: 0xFF0000, emoji: '❌', discordem: '❌', notification: true },
        // Other statuses from the table. I'll use the description as the primary message.
        '15': { name: 'fuera de servicio', description: 'Fuera de servicio por horario', isOperational: true, severity: 0, color: 0x808080, emoji: '🌙', discordem: '🌙', notification: false },
        '16': { name: 'operativo', description: 'Operativo', isOperational: true, severity: 0, color: 0x00FF00, emoji: '✅', discordem: '✅', notification: false },
        '17': { name: 'con demoras', description: 'Con demoras', isOperational: false, severity: 4, color: 0xFFA500, emoji: '🕰️', discordem: '🕰️', notification: true },
        '18': { name: 'servicio parcial', description: 'Servicio parcial', isOperational: false, severity: 3, color: 0xFFFF00, emoji: '⚠️', discordem: '⚠️', notification: true },
        '19': { name: 'suspendido', description: 'Suspendido', isOperational: false, severity: 1, color: 0xFF0000, emoji: '❌', discordem: '❌', notification: true },
        '20': { name: 'servicio extendido', description: 'Servicio extendido', isOperational: true, severity: 0, color: 0x0000FF, emoji: '🔄', discordem: '🔄', notification: false },
        'default': { name: 'desconocido', description: 'Estado desconocido', isOperational: false, severity: 5, color: 0xAAAAAA, emoji: '❓', discordem: '❓', notification: true },
    },
    // Metro operating hours
    horario: {
        Semana: ["6:00 AM", "11:00 PM"], // Weekdays
        Sábado: ["6:30 AM", "11:00 PM"], // Saturday
        Domingo: ["7:30 AM", "11:00 PM"], // Sunday
    },

    expressLines: [ "l2" , "l4" , "l5"],

    routeStyles: {
        'comun': { emoji: '<:comun:1348400171578425404>', message: 'Ruta Común' },
        'roja': { emoji: '<:roja:1348395124627083476>', message: 'Ruta Roja' },
        'verde': { emoji: '<:verde:1348394381928828993>', message: 'Ruta Verde' },
    },





    // API endpoint for Metro data

    // In metroConfig.js
    // In metroConfig.js - ONLY MODIFY THE api SECTION LIKE THIS:

    // From metroConfig.js
api: {
    headers: {
    'User-Agent': 'MetroSystem/1.0',
    'Accept': 'application/json'
  },
  // Retry parameters
  maxRetries: 5,                  // Maximum number of retry attempts
  baseRetryDelay: 1000,           // Initial retry delay in ms (1 second)
  maxRetryDelay: 30000,           // Maximum retry delay in ms (30 seconds)
  timeout: 8000,                  // Request timeout in ms (8 seconds)

  // Polling configuration
  pollingInterval: 60000          // 60 seconds between polls
},

    // Metro logo emoji
    logoMetroEmoji: '<:metrologo:1349494723760492594>',

    // Express route hours (only on weekdays)
    horarioExpreso: {
        morning: ["6:00", "9:00"], // Morning express
        evening: ["18:00", "21:00"], // Evening express
    },




    // Fare periods (PUNTA, VALLE, BAJO)
    horarioPeriodos: {
        PUNTA: [
            { inicio: "07:00:00", fin: "09:00:00" }, // Morning peak
            { inicio: "18:00:00", fin: "20:00:00" }, // Evening peak
        ],
        VALLE: [
            { inicio: "09:00:00", fin: "18:00:00" }, // Midday
            { inicio: "20:00:00", fin: "20:45:00" }, // Late evening
        ],
        BAJO: [
            { inicio: "06:00:00", fin: "07:00:00" }, // Early morning
             { inicio: "20:45:00", fin: "23:00:00" }, // Late night

        ],
        SERVICEHOURS: [
            { inicio: "06:00:00", fin: "23:00:00" }, // Weekdays
            { inicio: "06:30:00", fin: "23:00:00" }, // Saturday
            { inicio: "07:30:00", fin: "23:00:00" }, // Sunday
        ],
    },

    // Fare prices (in CLP)
    tarifario: {
        t_metro_punta: "870", // Peak fare
        t_metro_valle: "790", // Midday fare
        t_metro_bajo: "710", // Off-peak fare
        t_combinacion_punta: "870", // Combined peak fare
        t_combinacion_valle: "790", // Combined midday fare
        t_combinacion_bajo: "770", // Combined off-peak fare
        t_estudiante_punta: "250", // Student peak fare
        t_estudiante_valle: "250", // Student midday fare
        t_estudiante_bajo: "250", // Student off-peak fare
        t_adulto_punta: "250", // Adult peak fare
        t_adulto_valle: "250", // Adult midday fare
        t_adulto_bajo: "250", // Adult off-peak fare
        t_adultobip_punta: "370", // Adult BIP peak fare
        t_adultobip_valle: "370", // Adult BIP midday fare
        t_adultobip_bajo: "370", // Adult BIP off-peak fare
        t_nos_punta: "870", // NOS peak fare
        t_nos_valle: "790", // NOS midday fare
        t_nos_bajo: "710", // NOS off-peak fare
        t_transantiago: "770", // Transantiago fare
    },

    // Festive days (public holidays in Chile for 2025)
    festiveDays: [
        "2025-01-01", // New Year's Day
        "2025-04-18", // Good Friday
        "2025-04-19", // Holy Saturday
        "2025-05-01", // Labor Day
        "2025-05-21", // Navy Day
        "2025-06-29", // Saint Peter and Saint Paul
        "2025-07-16", // Our Lady of Mount Carmel
        "2025-08-15", // Assumption of Mary
        "2025-09-18", // Independence Day
        "2025-09-19", // Army Day
        "2025-10-12", // Columbus Day
        "2025-10-31", // Reformation Day
        "2025-11-01", // All Saints' Day
        "2025-12-08", // Immaculate Conception
        "2025-12-25", // Christmas Day
    ],

    // Special events (loaded from events.json)
    events: [], // Use the events loaded from the JSON file

    metroLogo: {

        principal: "https://media.discordapp.net/attachments/1326594661003034635/1352599491387195443/logo_metro_versiones-01.jpg?ex=67de99f0&is=67dd4870&hm=12e6ce0d9fe27d2f6e13094dd2330a99ae99b75552f92a875d90399afaf9254e&",

        v4: "https://cdn.discordapp.com/attachments/1326594661003034635/1352598809888161842/logo_metro_versiones-04.jpg?ex=67de994e&is=67dd47ce&hm=a1b60983ea95a1f85f590c3774d63aafb95a31fa84913f806d0c9a7d61a8b56d&",

        logoColores: "https://media.discordapp.net/attachments/1326594661003034635/1352600266343579780/elementosLogo.png?ex=67de9aa9&is=67dd4929&hm=9291375ec3675184e5e62b8896ecbf0d02b123f91688d1eb852cdbf49324010b&",

},


    emoji: {

        rendimiento: '⚡',

        equipamiento: '🔧',

        tecnico: '📐',

        tren: '🚄',

        fabricante: '🏭',

        años: '📅'

    },





// Access cards emojis

accessCards: {

    bip: '<:bip:1362491247033454592>',


    tne: '<:tne:1362491852770639953>',

    bipAdultoMayor: '<:bipAM:1362491794407031091>',

    tarjetaAdultoMayor: '<:tam:1362491662085128456>'

},



     services: {

         redbanc: "<:Redbanc:1365263970478460989>",

         telefono: "<:telefonos:1365275231987433492>",

         selfservice: "<:Autoservicio:1365412640389726238>" ,


        },


    accessibility: {

        ascensor: "<:Ascensor:1365310145990754425>",

        escaleras: "<:Scalators:1367116647525257237>",

        logo: "<:access:1365270122725376111>",

        estado: {

            ope:"<:ticketverde:1365268540969713725>",
            fes:"<:xroja:1365268321049772062>"
           },

        salida: "📤"





       },


    culture: {

        bibliometro: "<:Bibliometro:1365265373481533450>"

   },

    // Add this new section for commerce emojis


    commerce: {
    'Xs Market': '<:Xs:1365363619839082589>',
    'Castaño': '<:Castano:1365363632027865293>',
    'Piwen': '<:Piwen:1365363652479291503>',
    'Kino': '<:Kino:1365363666840715474>',
    'Cruz Verde': '<:Cruzverde:1365363676298608700>',
    'Correos de Chile': '<:Correoschile:1365363684867834017>',
    'Oxxo': '<:Oxxo:1365363699174604841>',
    'Subway': '<:Subway:1365363712868880495>',
    'San Camilo': '<:SanCamilo:1365363719743340586>',
    'Costanera Norte': '<:Costaneranorte:1365363748021211166>',
    'Chilexpress': '<:Chilexpress:1365363734054309900>',
    'Parque del Recuerdo': '<:ParquedelRecuerdo:1365363758314033195>',
    'Equifax': '<:Equifax:1365363770213535815>',
    'Bellota': '<:Bellota:1365363781357797447>',
    'Multiservice': '<:Multiservice:1365363788164894842>',
    // New additions
    'McDonald\'s': '<:McDonalds:1365366675981074553>',
    'KFC': '<:KFC:1365366643709968384>',
    'Ok Market' :'<:1000130840:1365367132182937752>',

        'Dr. Simi' : '<:DrSimi:1365368423797887096>',

        'Maxi-K' : '<:DrSimi:1365368423797887096>',

'Máquinas de Vending': '<:Vending:1365369184669929693>',

        'Turbus' : '<:Turbus:1365369966982987856>',

        'Servipag' : '<:Servipag:1365369941288681695>',

        'Savory' :'<:Savory:1365369735189102683>'
    },



}
