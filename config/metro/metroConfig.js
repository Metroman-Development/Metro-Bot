
// Load events from the JSON file
const events = require('./events.json');

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

    // Emojis for each Metro line
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

    statusMapping: {
    '0': {emoji: '🌙', message: 'Cierre por Horario'}, 
    '1': { emoji: '🟩', message: 'Operativa' },
    '2': { emoji: '🟥', message: 'Cerrada' },
    '3': { emoji: '🟨', message: 'Cierre Parcial' },
    '4': { emoji: '⏲️', message: 'Demoras en Frecuencia' },
    '5': { emoji: '<:extendida:1354249821829075155>', message: 'Ruta Extendida' }, // Extended Route
},

// Icons for stations
stationIcons: {
    'redoperativa': {emoji: '<:todalareddisponible:900165185321459773>', message: "Toda la Red Operativa"}, 
    0: { emoji: '🌙', message: 'Cierre por Horario' },
    1: { emoji: '<:operativa:1348394413357010984>', message: 'Operativa' },
    3: { emoji: '<:parcial:1348400125005008977>', message: 'Cierre Parcial' },
    2: { emoji: '<:cerrada:1348394347045064766>', message: 'Cierre Temporal' },
 
    4: { emoji: '⏲️', message: 'Retrasos en Frecuencia' },

 
    5: { emoji: '<:extendida:1354249821829075155>', message: 'Ruta Extendida' }, // Added extended status
    'comun': { emoji: '<:comun:1348400171578425404>', message: 'Ruta Común' },
    'roja': { emoji: '<:roja:1348395124627083476>', message: 'Ruta Roja' },
    'verde': { emoji: '<:verde:1348394381928828993>', message: 'Ruta Verde' },
},

// New dictionary for transfer combinations
combIcons: {
   0: {emoji: "🌙", message: "Cierre por Horario"}, 
    1: { emoji: '<:combOperativa:1362494217569697923>', message: 'Combinación Operativa' },
    2: { emoji: '<:combCerrada:1362494130361466900>', message: 'Combinación Cerrada' },
    3: { emoji: '<:combParcial:1362494331595915315>', message: 'Combinación Parcial' },
    5: { emoji: '<:combExtendida:1362494085923078326>', message: 'Combinación Extendida' },
},
    // Metro operating hours
    horario: {
        Semana: ["6:00 AM", "11:00 PM"], // Weekdays
        Sábado: ["6:30 AM", "11:00 PM"], // Saturday
        Domingo: ["7:30 AM", "11:00 PM"], // Sunday
    },

    expressLines: [ "l2" , "l4" , "l5"], 
                   
                  
                   
   
    
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
            { inicio: "20:00:00", fin: "23:00:00" }, // Late evening
        ],
        BAJO: [
            { inicio: "06:00:00", fin: "07:00:00" }, // Early morning

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
    events: events.events, // Use the events loaded from the JSON file

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
    
    NETWORK_STATUS_MAP: {

        1 : {emoji: '<:todalareddisponible:900165185321459773>', message: "Toda la Red Operativa"}, 

        0 : { emoji: '🌙', message: 'Cierre por Horario' },

       

       3: { emoji: '<:parcial:1348400125005008977>', message: 'Estacion(es) con Cierre Parcial en La Red' },

        2: { emoji: '<:cerrada:1348394347045064766>', message: 'Estaciones Cerradas en La Red' },

        4: { emoji: '⏲️', message: 'Red Con Retrasos' },
        
        5: { emoji: '🔵', message: 'Red con Servicio Extendido en Ciertas Estaciones' },

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
