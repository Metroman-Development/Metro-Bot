const { createEmbed } = require('../utils/embeds'); // Import the createEmbed function
const metroConfig = require('../config/metroConfig'); // Import the metroConfig file

module.exports = {
    name: 'guildMemberAdd',
    execute(member) {
        const welcomeChannel = member.guild.channels.cache.get(metroConfig.welcomeChannelID);

        if (!welcomeChannel) {
            console.error('Welcome channel not found!');
            return;
        }

        // Welcome message with emojis and formatting
        const welcomeMessage = `
¡Bienvenido/a al **Servidor No Oficial de Metro de Santiago**! 🚇🎉

Aquí encontrarás **información oficial** y **actualizaciones en tiempo real** sobre el estado de la red de Metro. Aquí te dejamos algunos canales importantes para empezar:

- 📊 **Estado de la Red**: Revisa <#1011417825862226023> para ver el estado actualizado de todas las líneas y estaciones.
- 🤖 **Funcionalidades Especiales**: Dirígete a <#899997769148821555> para probar mis comandos y funcionalidades exclusivas.

¡Esperamos que disfrutes tu estadía y encuentres toda la información que necesitas! Si tienes alguna duda, no dudes en preguntar. 😊
        `;

        // Create the embed using the createEmbed function
        const welcomeEmbed = createEmbed(welcomeMessage, 'success', `¡Bienvenido/a ${member.user.username}! 🎉`)
            .setThumbnail(member.user.displayAvatarURL()) // Add the user's avatar as the thumbnail
            .setTimestamp(); // Add a timestamp

        // Send the embed to the welcome channel
        welcomeChannel.send({ embeds: [welcomeEmbed] })
            .then(() => console.log(`Welcome embed sent to ${member.user.username}`))
            .catch(console.error);

        // Optionally, send a direct message to the new member
        member.send({ embeds: [welcomeEmbed] })
            .then(() => console.log(`Welcome DM sent to ${member.user.username}`))
            .catch(() => console.log(`Could not send DM to ${member.user.username}. They might have DMs disabled.`));
    },
};