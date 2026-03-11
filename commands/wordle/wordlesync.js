const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { Op } = require('sequelize');

const WORDLE_CHANNEL_ID = '930279618437586974';
const WORDLE_REGEX = /Wordle\s+([\d,]+)\s+([X1-6])\/6(\*)?/i;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('wordlesync')
        .setDescription('Import historical Wordle scores from the channel (Admin only)')
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
        const WordleScore = interaction.client.models.WordleScore;

        try {
            // Get the Wordle channel
            const channel = await interaction.client.channels.fetch(WORDLE_CHANNEL_ID);
            if (!channel) {
                return interaction.editReply('Could not find the Wordle channel.');
            }

            await interaction.editReply(`🔄 Starting sync... Scanning up to ${limit} messages.`);

            // First, collect all messages
            const allScores = [];
            let processed = 0;
            let lastId = null;
            let messagesRemaining = limit;

            // Fetch all messages first (fast)
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

                    const match = message.content.match(WORDLE_REGEX);
                    if (!match) continue;

                    const wordleNumber = parseInt(match[1].replace(/,/g, ''), 10);
                    const scoreStr = match[2];
                    const hardMode = match[3] === '*';
                    const score = scoreStr.toUpperCase() === 'X' ? 7 : parseInt(scoreStr, 10);

                    allScores.push({
                        userId: message.author.id,
                        username: message.author.username,
                        wordleNumber: wordleNumber,
                        score: score,
                        hardMode: hardMode,
                        messageId: message.id,
                        postedAt: message.createdAt,
                    });
                }

                messagesRemaining -= messages.size;

                if (processed % 500 === 0) {
                    await interaction.editReply(`🔄 Fetching messages: ${processed}/${limit} scanned, ${allScores.length} Wordle posts found...`);
                }

                // Small delay to avoid rate limits
                await new Promise(resolve => setTimeout(resolve, 50));
            }

            await interaction.editReply(`🔄 Found ${allScores.length} Wordle posts in ${processed} messages. Importing to database...`);

            // Find which scores already exist so we can accurately count new vs skipped
            const existingScores = await WordleScore.findAll({
                where: {
                    [Op.or]: allScores.map(s => ({ userId: s.userId, wordleNumber: s.wordleNumber })),
                },
                attributes: ['userId', 'wordleNumber'],
            });
            const existingSet = new Set(existingScores.map(s => `${s.userId}:${s.wordleNumber}`));
            const newScores = allScores.filter(s => !existingSet.has(`${s.userId}:${s.wordleNumber}`));
            const skipped = allScores.length - newScores.length;

            // Bulk insert only truly new scores
            let imported = 0;
            for (let i = 0; i < newScores.length; i += 100) {
                const batch = newScores.slice(i, i + 100);
                await WordleScore.bulkCreate(batch, { ignoreDuplicates: true });
                imported += batch.length;
            }

            // React 📊 to each newly imported message
            for (const scoreData of newScores) {
                try {
                    const msg = await channel.messages.fetch(scoreData.messageId);
                    await msg.react('📊');
                } catch (_) {
                    // Message may have been deleted — skip silently
                }
            }

            await interaction.editReply(
                `✅ **Sync Complete!**\n` +
                `📨 Messages scanned: ${processed}\n` +
                `🎯 Wordle posts found: ${allScores.length}\n` +
                `✅ Scores imported: ${imported}\n` +
                `⏭️ Already existed: ${skipped}`
            );

        } catch (error) {
            console.error('Error syncing Wordle scores:', error);
            await interaction.editReply(`An error occurred while syncing Wordle scores: ${error.message}`);
        }
    },
};
