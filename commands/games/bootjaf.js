const fetch = require('node-fetch');
const { SlashCommandBuilder } = require('discord.js');
const Sequelize = require('sequelize');
const sequelize = require('../../db.js');
const { GIPHYApiKey } = require('../../config.json');

const BootJaf = require('../../models/BootJaf')(sequelize, Sequelize.DataTypes);

module.exports = {
	data: new SlashCommandBuilder()
		.setName('bootjaf')
		.setDescription('Count the times we boot jaf'),
    async execute(interaction) {

        const bootJafCount = await BootJaf.findOne({
            order: [ [ 'createdAt', 'DESC' ] ],
        });

        const bootJafCountDisplay = bootJafCount.usage_count + 1;

        const isDevilCount = bootJafCountDisplay === 666;

        interaction.reply(isDevilCount ? `😈 ${bootJafCountDisplay} 😈` : `${bootJafCountDisplay}`);

        try {
            await BootJaf.create({
                username: interaction.user.username,
                usage_count: bootJafCountDisplay,
            });
        }
        catch (error) {
            console.log(error);
        }

        if (isDevilCount) {
            interaction.channel.send('The number of the beast has been reached. Jaf has been booted straight to hell.');
        }

        const searchTerm = isDevilCount ? 'satan' : 'milk';
        const url = `https://api.giphy.com/v1/gifs/search?api_key=${GIPHYApiKey}&q=${searchTerm}&limit=50&rating=r`;
        const response = await fetch(url);
        const json = await response.json();

        const index = Math.floor(Math.random() * json.data.length);

        interaction.channel.send(json.data[index].url);
    },
};