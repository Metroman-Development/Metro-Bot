/*const moment = require('moment-timezone');

const metroConfig = require('../config/metroConfig');

const logger = require('../events/logger');

/**

 * Get the current time in Chile (automatically adjusts for DST).

 * @returns {moment.Moment} The current time in Chile.

 */
/*
function getCurrentChileTime() {

    return moment().tz('America/Santiago'); // Automatically adjusts for DST

}

/**

 * Check if the current day is a weekday (Monday to Friday) and not a festive day.

 * @returns {boolean} True if it's a weekday and not a festive day, false otherwise.

 */
/*
function isWeekday() {

    const currentDay = getCurrentDay(); // Get the current day of the week

    const isFestive = isFestiveDay(); // Check if it's a festive day

    // Check if the current day is a weekday (Monday to Friday) and not a festive day

    return currentDay !== 'Sábado' && currentDay !== 'Domingo' && !isFestive;

}

/**

 * Check if express routes are currently active.

 * @returns {boolean} True if express routes are active, false otherwise.

 */
/*
function isExpressActive() {

    // Express routes are only active on weekdays

    if (!isWeekday()) {

        return false;

    }

    const currentTime = getCurrentChileTime();

    const expressHours = metroConfig.horarioExpreso;

    // Convert current time to minutes since midnight

    const currentMinutes = currentTime.hours() * 60 + currentTime.minutes();

    // Check morning express hours

    const [morningStart, morningEnd] = expressHours.morning;

    const morningStartMinutes = convertTimeToMinutes(morningStart);

    const morningEndMinutes = convertTimeToMinutes(morningEnd);

    if (currentMinutes >= morningStartMinutes && currentMinutes <= morningEndMinutes) {

        return true; // Morning express is active

    }

    // Check evening express hours

    const [eveningStart, eveningEnd] = expressHours.evening;

    const eveningStartMinutes = convertTimeToMinutes(eveningStart);

    const eveningEndMinutes = convertTimeToMinutes(eveningEnd);

    if (currentMinutes >= eveningStartMinutes && currentMinutes <= eveningEndMinutes) {

        return true; // Evening express is active

    }

    return false; // Express routes are not active

}

/**

 * Convert a time string (e.g., "6:00 AM") to minutes since midnight.

 * @param {string} timeStr - The time string to convert.

 * @returns {number} The number of minutes since midnight.

 */
/*function convertTimeToMinutes(timeStr) {

    const time = moment(timeStr, 'h:mm A');

    return time.hours() * 60 + time.minutes();

}

// Function to get current day of the week

function getCurrentDay() {

    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

    return days[getCurrentChileTime().day()]; // day() returns 0 (Sunday) to 6 (Saturday)

}

// Function to get current time in HH:MM:SS format

function getCurrentTime() {

    return getCurrentChileTime().format('HH:mm:ss');

}

// Function to check if today is a festive day

function isFestiveDay() {

    const currentDate = getCurrentChileTime().format('YYYY-MM-DD');

    return metroConfig.festiveDays.includes(currentDate);

}

// Function to check if today is a special event day

function isEventDay() {

    const currentDate = getCurrentChileTime().format('YYYY-MM-DD');

    return metroConfig.events.find(event => event.date === currentDate) || null;

}

// Function to get extended hours for today (if applicable)

function getExtendedHours() {

    const event = isEventDay();

    return event ? event.extendedHours : null;

}

// Function to parse time strings into minutes since midnight

function parseTimeToMinutes(timeStr) {

    const [time, modifier] = timeStr.split(' ');

    let [hours, minutes] = time.split(':');

    hours = parseInt(hours);

    minutes = parseInt(minutes || 0);

    if (modifier === 'PM' && hours < 12) hours += 12;

    if (modifier === 'AM' && hours === 12) hours = 0;

    return hours * 60 + minutes;

}

// Function to check if outside operating hours

function isOutsideOperatingHours(horario) {

    const currentDay = getCurrentDay(); // Get the current day of the week

    const currentTime = getCurrentTime(); // Get the current time in HH:mm:ss format

    // Determine the operating hours based on the current day

    let operatingHours;

    if (currentDay === 'Sábado') {

        operatingHours = horario.Sábado; // Saturday hours

    } else if (currentDay === 'Domingo' || isFestiveDay()) {

        operatingHours = horario.Domingo; // Sunday or festive day hours

    } else {

        operatingHours = horario.Semana; // Weekday hours

    }

    // If no operating hours are found, default to weekday hours

    if (!operatingHours) {

        operatingHours = horario.Semana;

    }

    // Parse the operating hours into minutes since midnight

    const [openTime, closeTime] = operatingHours;

    const currentMinutes = parseTimeToMinutes(currentTime);

    const openMinutes = parseTimeToMinutes(openTime);

    const closeMinutes = parseTimeToMinutes(closeTime);

    // Check if the current time is outside the operating hours

    return currentMinutes < openMinutes || currentMinutes > closeMinutes;

}

/**

 * Check if the current time falls within a specific period.

 * @param {string} currentTime - The current time in HH:mm:ss format.

 * @param {Array} period - The period to check (e.g., PUNTA, VALLE, BAJO).

 * @returns {boolean} True if the current time is within the period, false otherwise.

 */
/*
function isTimeInPeriod(currentTime, period) {

    for (const range of period) {

        if (currentTime >= range.inicio && currentTime <= range.fin) {

            return true;

        }

    }

    return false;

}

/**

 * Get the current fare period based on the current time.

 * @param {string} currentTime - The current time in HH:mm:ss format.

 * @returns {string} The current fare period (e.g., "PUNTA", "VALLE", "BAJO").

 */
/*
function getCurrentFarePeriod() {
    console.log("Retrieving Fare Period");
    const timei = getCurrentTime();

    if (isTimeInPeriod(timei, metroConfig.horarioPeriodos.PUNTA)) {
        console.log("PUNTA");
        return 'PUNTA';
    } else if (isTimeInPeriod(timei, metroConfig.horarioPeriodos.VALLE)) {
        console.log("VALLE");
        return 'VALLE';
    } else if (isTimeInPeriod(timei, metroConfig.horarioPeriodos.BAJO)) {
        console.log("BAJO");
        return 'BAJO';
    } else {
        console.log("NINGUNO");
        return 'Fuera de Horario de Servicio'; // Outside operating hours
    }
}

module.exports = {

    getCurrentChileTime,

    getCurrentDay,

    getCurrentTime,

    isFestiveDay,

    isEventDay,

    getExtendedHours,

    isOutsideOperatingHours,

    isExpressActive,

    convertTimeToMinutes,

    isWeekday, // Export the new function

    isTimeInPeriod,

    getCurrentFarePeriod,

};*/