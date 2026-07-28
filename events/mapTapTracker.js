const { Events } = require('discord.js');
const { parseMapTapShare } = require('../utils/parseMapTap');

const MAPTAP_CHANNEL_ID = '1528771977995620574';

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        if (message.channel.id !== MAPTAP_CHANNEL_ID) return;
        if (message.author.bot) return;

        const parsed = parseMapTapShare(message.content, message.createdAt.getFullYear());
        if (!parsed) return;

        const { puzzleDate, roundScores, finalScore } = parsed;

        try {
            const MapTapScore = message.client.models.MapTapScore;

            const existing = await MapTapScore.findOne({
                where: {
                    userId: message.author.id,
                    puzzleDate,
                },
            });

            if (existing) return;

            await MapTapScore.create({
                userId: message.author.id,
                username: message.author.username,
                puzzleDate,
                roundScores,
                finalScore,
                messageId: message.id,
                postedAt: message.createdAt,
            });

            await message.react('🗺️');

        } catch (error) {
            console.error('Error storing MapTap score:', error);
        }
    },
};
