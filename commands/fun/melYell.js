const fetch = require('node-fetch');
const { SlashCommandBuilder } = require('discord.js');
const { GIPHYApiKey } = require('../../config.json');

module.exports = {
	data: new SlashCommandBuilder()
        .setName('mel')
        .setDescription('Mella Yellin'),
    async execute(interaction) {

        const url = `https://api.giphy.com/v1/gifs/search?api_key=${GIPHYApiKey}&q=yell&limit=50&rating=r`;
        const response = await fetch(url);
        const json = await response.json();

        const index = Math.floor(Math.random() * json.data.length);

        interaction.reply(json.data[index].url);
    },
};