const { EmbedBuilder } = require('discord.js');
const { randomInt } = require('crypto');

module.exports = {
    name: 'guildMemberAdd',
    once: false,
    async execute(member) {
        // Configuración
        const welcomeChannelId = '899844115934642176';
        const defaultRoleId = null; // Opcional: ID de rol para nuevos miembros
        
        // Mensajes aleatorios de bienvenida
        const welcomeMessages = [
            `¡Bienvenid@ al equipo, **${member.user.username}**! 🌟 Esperamos que te sientas como en casa.`,
            `¡Un caluroso saludo para **${member.user.username}**! 🎉 No dudes en explorar el servidor.`,
            `¡Hola **${member.user.username}**! 👋 ¡La familia crece! ¿Qué tal tu día?`,
            `¡**${member.user.username}** ha aparecido! ✨ ¿List@ para divertirte?`,
            `¡Guau! Mira quién está aquí — ¡**${member.user.username}**! 🐶 ¡Nos encanta tenerte con nosotros!`,
            `¡Bienvenid@ a bordo, **${member.user.username}**! 🚀 Prepárate para una gran aventura.`,
            `¡Sopla las velas! 🎂 **${member.user.username}** acaba de unirse a esta gran familia.`,
            `¡Atención todos! 👀 **${member.user.username}** se ha unido al servidor. ¡Démosle una cálida bienvenida!`
        ];

        // Emojis aleatorios para el título
        const welcomeEmojis = ['🌟', '🎉', '👋', '✨', '🐶', '🚀', '🎂', '👀', '🌈', '🎊'];
        
        try {
            const welcomeChannel = member.guild.channels.cache.get(welcomeChannelId);
            if (!welcomeChannel) {
                console.error(`❌ Canal de bienvenida no encontrado`);
                return;
            }

            // Seleccionar elementos aleatorios
            const randomMessage = welcomeMessages[randomInt(0, welcomeMessages.length)];
            const randomEmoji = welcomeEmojis[randomInt(0, welcomeEmojis.length)];
            const randomColor = Math.floor(Math.random()*16777215).toString(16);

            // Crear embed
            const welcomeEmbed = new EmbedBuilder()
                .setColor(`#${randomColor}`)
                .setTitle(`${randomEmoji} ¡Nuev@ miembro! ${randomEmoji}`)
                .setDescription(randomMessage)
                .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
                .addFields(
                    { name: '📅 Cuenta creada', value: `<t:${Math.floor(member.user.createdTimestamp/1000)}:R>`, inline: true },
                    { name: '👥 Miembros', value: `${member.guild.memberCount}`, inline: true }
                )
                //.setImage('https://i.imgur.com/kyYV5z0.gif') // Reemplaza con tu GIF
                .setTimestamp()
                .setFooter({ text: '¡Disfruta tu estadía!' });

            // Enviar mensaje con mención
            await welcomeChannel.send({
                content: `¡Hey <@${member.user.id}>! ${randomMessage.split('!')[0]}!`,
                embeds: [welcomeEmbed]
            });

            // Asignar rol automático (opcional)
            if (defaultRoleId) {
                const role = member.guild.roles.cache.get(defaultRoleId);
                if (role) await member.roles.add(role).catch(console.error);
            }

            console.log(`✅ Bienvenida aleatoria enviada a ${member.user.tag}`);

        } catch (error) {
            console.error('❌ Error en guildMemberAdd:', error);
        }
    }
};