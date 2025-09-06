module.exports = {
  execute: async (ctx) => {
    const user = ctx.from;
    const userInfo = `
**Información del Usuario:**
- **ID:** \`${user.id}\`
- **Nombre:** ${user.first_name} ${user.last_name || ''}
- **Username:** @${user.username}
- **Idioma:** ${user.language_code}
    `;

    const photos = await ctx.telegram.getUserProfilePhotos(user.id);
    if (photos && photos.total_count > 0) {
      const photoId = photos.photos[0][0].file_id;
      await ctx.replyWithPhoto(photoId, { caption: userInfo, parse_mode: 'Markdown' });
    } else {
      await ctx.replyWithMarkdown(userInfo);
    }
  },
  description: 'Muestra información sobre un usuario.',
};
