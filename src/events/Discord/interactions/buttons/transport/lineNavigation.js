// buttons/transport/lineNavigation.js

const { NavigationTemplate } = require('../templates/navigation.js');

const generalLineInfo = require('../../../config/defaultEmbeds/generalLineInfo');

module.exports = NavigationTemplate.create({

    idPrefix: 'line',

    async fetchState(lineKey) {

        return getLineData(lineKey);

    },

    buildEmbed(lineData, interaction) {

        const { embed, buttons } = generalLineInfo(

            lineData, 

            interaction.user.id,

            interaction.id

        );

        

        if (['l2', 'l4', 'l5'].includes(lineData.key)) {

            embed.setDescription(`${embed.description}\n\n🚄 Express: ${isExpressActive() ? 'Active' : 'Inactive'}`);

        }

        

        return { embed, buttons };

    }

});