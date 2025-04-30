const logger = require('../events/logger');

// Función para calcular el nivel basado en Bip!Coins (crecimiento cuadrático)
function calculateLevel(bipCoins) {
    return Math.floor(Math.pow(bipCoins / 100, 0.5)); // Raíz cuadrada para un crecimiento más suave
}

// Función para calcular los Bip!Coins necesarios para un nivel específico
function calculateBipCoinsForLevel(level) {
    return Math.pow(level, 2) * 100; // Crecimiento cuadrático
}

// Función para verificar si dos fechas son el mismo día
function isSameDay(date1, date2) {
    return (
        date1.getDate() === date2.getDate() &&
        date1.getMonth() === date2.getMonth() &&
        date1.getFullYear() === date2.getFullYear()
    );
}

// Función para verificar el cooldown de un usuario
function checkCooldown(userId, cooldowns, cooldownTime) {
    const now = Date.now();
    const lastActivity = cooldowns.get(userId) || 0;

    if (now - lastActivity < cooldownTime) {
        const remainingTime = Math.ceil((cooldownTime - (now - lastActivity)) / 1000);
        logger.info(`⏳ El usuario ${userId} está en cooldown. Tiempo restante: ${remainingTime} segundos.`);
        return remainingTime; // Devuelve el tiempo restante en segundos
    }

    return 0; // No hay cooldown activo
}

module.exports = {
    calculateLevel,
    calculateBipCoinsForLevel,
    isSameDay,
    checkCooldown
};
      