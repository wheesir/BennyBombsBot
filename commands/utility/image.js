const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { geminiApiKey, geminiImageModel } = require('../../config.json');
const Sequelize = require('sequelize');
const sequelize = require('../../db.js');

const OpenAIAPIUsage = require('../../models/OpenAIAPIUsage')(sequelize, Sequelize.DataTypes);

const genAI = new GoogleGenerativeAI(geminiApiKey);
const model = genAI.getGenerativeModel({
  model: geminiImageModel,
  generationConfig: { responseModalities: ['Text', 'Image'] },
});

module.exports = {
  data: new SlashCommandBuilder()
    .setName('image')
    .setDescription('Generate an image from a prompt')
    .addStringOption(option => option
      .setName('prompt')
      .setDescription('The prompt for generating the image')
      .setRequired(true)),
  async execute(interaction) {
    if (!interaction.isCommand()) return; // Ignore non-command interactions

    const userPrompt = interaction.options.getString('prompt');

    try {
      await OpenAIAPIUsage.create({
          username: interaction.user.username,
          prompt: userPrompt,
          type: 'image',
      });
    }
    catch (error) {
        console.log(error);
    }

    // Acknowledge the interaction
    await interaction.deferReply();

    try {
      const result = await model.generateContent(userPrompt);
      const parts = result.response.candidates?.[0]?.content?.parts || [];
      const imagePart = parts.find(part => part.inlineData);

      if (imagePart) {
        // Gemini returns the image as inline base64 data, so attach it directly
        const buffer = Buffer.from(imagePart.inlineData.data, 'base64');
        const attachment = new AttachmentBuilder(buffer, { name: 'image.png' });
        const embed = new EmbedBuilder()
          .setImage('attachment://image.png');

        await interaction.editReply({ embeds: [embed], files: [attachment] });
      } else {
        await interaction.followUp('Failed to generate an image.');
      }
    } catch (error) {
      const errorMessage = 'Gemini API Error: ' + (error.message || 'Unknown error');
      await interaction.followUp(errorMessage);
    }
  },
};
