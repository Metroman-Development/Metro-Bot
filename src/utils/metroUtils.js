const metroConfig = require('../config/metro/metroConfig');

function getLineColor(line) {
    return metroConfig.lineColors?.[line?.toLowerCase()] || 0x000000;
}

function getLineImage(line) {
    return `https://www.metro.cl/images/lines/line-${line || 'default'}.png`;
}

module.exports = {
    getLineColor,
    getLineImage,
};
