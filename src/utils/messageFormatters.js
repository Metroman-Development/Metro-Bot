const metroConfig = require('../config/metro/metroConfig');

function _translateToTelegramEmoji(discordEmoji) {
  const emojiMap = {
    '🚨': '🚨', '⚠️': '⚠️', 'ℹ️': 'ℹ️',
    '🔵': '🔵', '🟢': '🟢',
    '🟡': '🟡', '🔴': '🔴'
  };
  return emojiMap[discordEmoji] || '';
}

function _processForTelegram(text) {
  if (typeof text !== 'string') return text;
  return text
    .replace(/\bl1\b/gi, 'Línea 1')
    .replace(/\bl2\b/gi, 'Línea 2')
    .replace(/\bl3\b/gi, 'Línea 3')
    .replace(/\bl4\b/gi, 'Línea 4')
    .replace(/\bl4a\b/gi, 'Línea 4A')
    .replace(/\bl5\b/gi, 'Línea 5')
    .replace(/\bl6\b/gi, 'Línea 6')
    .replace(/\bl7\b/gi, 'Línea 7')
    .replace(/\bl8\b/gi, 'Línea 8')
    .replace(/\bl9\b/gi, 'Línea 9')
    .replace(/\$verde/gi, '[Estación Verde]')
    .replace(/\$roja/gi, '[Estación Roja]')
    .replace(/\$comun/gi, '[Estación Común]');
}

function _translateUrgencyEmoji(emoji) {
  const urgencyMap = {
    '🚨': 'Alta', '⚠️': 'Media', 'ℹ️': 'Baja',
    '🔵': 'Informativa', '🟢': 'Normal',
    '🟡': 'Advertencia', '🔴': 'Crítica'
  };
  return urgencyMap[emoji] || '';
}

function _getUrgencyColor(urgency) {
  const colorMap = {
    'Alta': 0xFF0000, 'Media': 0xFFA500,
    'Baja': 0xFFFF00, 'Informativa': 0x0000FF,
    'Normal': 0x00FF00, 'Advertencia': 0xFFA500,
    'Crítica': 0xFF0000
  };
  return colorMap[urgency] || 0x3498DB;
}

function _processLineKeywords(text) {
  if (typeof text !== 'string') return text;
  return text
    .replace(/\bl1\b/gi, metroConfig.linesEmojis.l1)
    .replace(/\bl2\b/gi, metroConfig.linesEmojis.l2)
    .replace(/\bl3\b/gi, metroConfig.linesEmojis.l3)
    .replace(/\bl4\b/gi, metroConfig.linesEmojis.l4)
    .replace(/\bl4a\b/gi, metroConfig.linesEmojis.l4a)
    .replace(/\bl5\b/gi, metroConfig.linesEmojis.l5)
    .replace(/\bl6\b/gi, metroConfig.linesEmojis.l6)
    .replace(/\bl7\b/gi, metroConfig.linesEmojis.l7)
    .replace(/\bl8\b/gi, metroConfig.linesEmojis.l8)
    .replace(/\bl9\b/gi, metroConfig.linesEmojis.l9)
    .replace(/\$verde/gi, metroConfig.routeStyles.verde.emoji)
    .replace(/\$roja/gi, metroConfig.routeStyles.roja.emoji)
    .replace(/\$comun/gi, `${metroConfig.routeStyles.comun.emoji}`);
}

module.exports = {
  translateToTelegramEmoji: _translateToTelegramEmoji,
  processForTelegram: _processForTelegram,
  translateUrgencyEmoji: _translateUrgencyEmoji,
  getUrgencyColor: _getUrgencyColor,
  processLineKeywords: _processLineKeywords
};
