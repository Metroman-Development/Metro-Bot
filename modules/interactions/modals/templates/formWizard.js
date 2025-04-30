const { ModalBuilder, TextInputBuilder } = require('discord.js');

class FormWizard {
    constructor(steps = []) {
        this.steps = steps;
        this.currentStep = new Map(); // userId -> stepIndex
        this.responses = new Map(); // userId -> responses
    }

    async execute(userId, interaction) {
        this.currentStep.set(userId, 0);
        await this.showStep(userId, interaction);
    }

    async showStep(userId, interaction) {
        const step = this.steps[this.currentStep.get(userId)];
        
        const modal = new ModalBuilder()
            .setCustomId(`formStep_${userId}`)
            .setTitle(step.title);

        modal.addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('response')
                    .setLabel(step.question)
                    .setStyle(step.style || TextInputStyle.Short)
            )
        );

        await interaction.showModal(modal);
    }

    async handleSubmit(interaction) {
        const userId = interaction.user.id;
        const response = interaction.fields.getTextInputValue('response');
        
        // Store response
        if (!this.responses.has(userId)) {
            this.responses.set(userId, {});
        }
        this.responses.get(userId)[this.currentStep.get(userId)] = response;

        // Move to next step or complete
        if (this.currentStep.get(userId) < this.steps.length - 1) {
            this.currentStep.set(userId, this.currentStep.get(userId) + 1);
            await this.showStep(userId, interaction);
        } else {
            await this.onComplete(interaction, this.responses.get(userId));
            this.cleanup(userId);
        }
    }

    cleanup(userId) {
        this.currentStep.delete(userId);
        this.responses.delete(userId);
    }
}

module.exports=FormWizard;