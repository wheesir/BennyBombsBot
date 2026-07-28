const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { Op } = require('sequelize');
const { parseMapTapShare } = require('../../utils/parseMapTap');

const MAPTAP_CHANNEL_ID = '1528771977995620574';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('maptapsync')
        .setDescription('Import historical MapTap scores from the channel (Admin only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addIntegerOption(option =>
            option.setName('limit')
                .setDescription('Maximum messages to scan (default: 5000, max: 50000)')
                .setRequired(false)
                .setMinValue(100)
                .setMaxValue(50000)),
    async execute(interaction) {
        await interaction.deferReply();

        const limit = interaction.options.getInteger('limit') || 5000;
        const MapTapScore = interaction.client.models.MapTapScore;

        try {
            const channel = await interaction.client.channels.fetch(MAPTAP_CHANNEL_ID);
            if (!channel) {
                return interaction.editReply('Could not find the MapTap channel.');
            }

            await interaction.editReply(`🔄 Starting sync... Scanning up to ${limit} messages in ${channel}.`);

            const allScores = [];
            let processed = 0;
            let lastId = null;
            let messagesRemaining = limit;

            while (messagesRemaining > 0) {
                const fetchLimit = Math.min(100, messagesRemaining);
                const options = { limit: fetchLimit };
                if (lastId) options.before = lastId;

                const messages = await channel.messages.fetch(options);
                if (messages.size === 0) break;

                for (const [, message] of messages) {
                    processed++;
                    lastId = message.id;

                    if (message.author.bot) continue;

                    const parsed = parseMapTapShare(message.content, message.createdAt.getFullYear());
                    if (!parsed) continue;

                    allScores.push({
                        userId: message.author.id,
                        username: message.author.username,
                        puzzleDate: parsed.puzzleDate,
                        roundScores: parsed.roundScores,
                        finalScore: parsed.finalScore,
                        messageId: message.id,
                        postedAt: message.createdAt,
                    });
                }

                messagesRemaining -= messages.size;

                if (processed % 500 === 0) {
                    await interaction.editReply(`🔄 Fetching messages: ${processed}/${limit} scanned, ${allScores.length} MapTap posts found...`);
                }

                await new Promise(resolve => setTimeout(resolve, 50));
            }

            await interaction.editReply(`🔄 Found ${allScores.length} MapTap posts in ${processed} messages. Importing to database...`);

            const existingScores = await MapTapScore.findAll({
                where: {
                    [Op.or]: allScores.map(s => ({ userId: s.userId, puzzleDate: s.puzzleDate })),
                },
                attributes: ['userId', 'puzzleDate'],
            });
            const existingSet = new Set(existingScores.map(s => `${s.userId}:${s.puzzleDate}`));
            const newScores = allScores.filter(s => !existingSet.has(`${s.userId}:${s.puzzleDate}`));
            const skipped = allScores.length - newScores.length;

            let imported = 0;
            for (let i = 0; i < newScores.length; i += 100) {
                const batch = newScores.slice(i, i + 100);
                await MapTapScore.bulkCreate(batch, { ignoreDuplicates: true });
                imported += batch.length;
            }

            for (const scoreData of newScores) {
                try {
                    const msg = await channel.messages.fetch(scoreData.messageId);
                    await msg.react('🗺️');
                } catch (_) {
                    // Message may have been deleted — skip silently
                }
            }

            await interaction.editReply(
                `✅ **Sync Complete!**\n` +
                `📨 Messages scanned: ${processed}\n` +
                `🎯 MapTap posts found: ${allScores.length}\n` +
                `✅ Scores imported: ${imported}\n` +
                `⏭️ Already existed: ${skipped}`
            );

        } catch (error) {
            console.error('Error syncing MapTap scores:', error);
            await interaction.editReply(`An error occurred while syncing MapTap scores: ${error.message}`);
        }
    },
};
