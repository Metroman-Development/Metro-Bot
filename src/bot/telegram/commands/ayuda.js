const fs = require('fs');
const path = require('path');

module.exports = {
  execute: async (ctx) => {
    const commandsPath = path.join(__dirname);
    const commandFiles = fs.readdirSync(commandsPath).filter(file =>
      file.endsWith('.js') && !file.startsWith('.') && file !== 'ayuda.js'
    );

    let commandsList = [];

    for (const file of commandFiles) {
      const commandName = file.replace('.js', '');
      const command = require(path.join(commandsPath, file));

      // Skip if the command has no description (optional)
      if (!command.description) continue;

      commandsList.push(`/${commandName} - ${command.description}`);
    }

    const helpMessage = `
🚇 <b>Comandos disponibles:</b> 🚇

${commandsList.join('\n')}

📌 <b>Uso:</b>
• Escribe un comando para ejecutarlo.
• Ejemplo: <code>/ping</code> verifica la latencia del bot.

ℹ️ ¿Necesitas ayuda? Contacta a los administradores.
    `;

    await ctx.reply(helpMessage, {
      parse_mode: 'HTML',
      disable_web_page_preview: true
    });
  },
  description: "Muestra todos los comandos disponibles y su descripción" // Meta-description for /ayuda
};
