module.exports = {
    // Mapeo de roles
    ROLES: {
        'Pasajero Ocasional': '908460365069815848', // ID del rol
        'Viajero Frecuente': '908461746660978748',
        'Explorador del Metro': '908461899551764490',
        'Maestro de Líneas': '1353384386728300697',
        'Experto del Metro': '1353417394546282496', // Nuevo rol en nivel 50
        'Veterano del Metro': '1353419063019442292', // Nuevo rol en nivel 75
        'Leyenda del Metro': '1353384386728300699'
    },

    // Puntos base por tipo de actividad
    BASE_POINTS: {
        message: 5,       // Puntos por enviar un mensaje
        command: 10,      // Puntos por usar un comando
        voice: 7          // Puntos por estar en un canal de voz
    },

    // Bonificación por primera actividad del día
    FIRST_ACTIVITY_BONUS: 20,

    // Cooldown de 1 minuto (60000 milisegundos)
    COOLDOWN_TIME: 60000,

    // IDs de canales
    CHANNELS: {
        announcements: '1347146518943105085' // ID del canal de anuncios
    },

    // Niveles y recompensas
    LEVEL_REWARDS: [
        { level: 1, role: 'Pasajero Ocasional' },
        { level: 5, role: 'Viajero Frecuente' },
        { level: 10, role: 'Explorador del Metro' },
        { level: 20, role: 'Maestro de Líneas' },
        { level: 50, role: 'Experto del Metro' },
        { level: 75, role: 'Veterano del Metro' },
        { level: 100, role: 'Leyenda del Metro' }
    ]
};
