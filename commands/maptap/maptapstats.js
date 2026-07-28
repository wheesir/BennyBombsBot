const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { Op } = require('sequelize');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('maptapstats')
        .setDescription('View your MapTap stats: average, best/worst score, and per-round breakdown')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User to view stats for (defaults to you)')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('period')
                .setDescription('Filter stats to a specific time period')
                .setRequired(false)
                .addChoices(
                    { name: 'All Time', value: 'all' },
                    { name: 'This Year', value: 'year' },
                    { name: 'This Month', value: 'month' },
                    { name: 'This Week', value: 'week' },
                )),
    async execute(interaction) {
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const period = interaction.options.getString('period') || 'all';

        const MapTapScore = interaction.client.models.MapTapScore;

        const now = new Date();
        let dateFilter = {};

        if (period === 'year') {
            const startOfYear = new Date(now.getFullYear(), 0, 1);
            dateFilter = { postedAt: { [Op.gte]: startOfYear } };
        } else if (period === 'month') {
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            dateFilter = { postedAt: { [Op.gte]: startOfMonth } };
        } else if (period === 'week') {
            const startOfWeek = new Date(now);
            startOfWeek.setDate(now.getDate() - now.getDay());
            startOfWeek.setHours(0, 0, 0, 0);
            dateFilter = { postedAt: { [Op.gte]: startOfWeek } };
        }

        try {
            const scores = await MapTapScore.findAll({
                where: {
                    userId: targetUser.id,
                    ...dateFilter,
                },
                order: [['puzzleDate', 'DESC']],
            });

            if (scores.length === 0) {
                return interaction.reply({
                    content: `No MapTap scores found for ${targetUser.username} in the selected period.`,
                    flags: MessageFlags.Ephemeral,
                });
            }

            const totalGames = scores.length;
            const finalScores = scores.map(s => s.finalScore);
            const avgScore = (finalScores.reduce((sum, s) => sum + s, 0) / totalGames).toFixed(1);
            const bestScore = Math.max(...finalScores);
            const worstScore = Math.min(...finalScores);

            // Per-round averages (rounds are positional: round 1, 2, 3...)
            const maxRounds = Math.max(...scores.map(s => (s.roundScores || []).length));
            const roundAverages = [];
            for (let i = 0; i < maxRounds; i++) {
                const values = scores.map(s => s.roundScores?.[i]).filter(v => typeof v === 'number');
                if (values.length > 0) {
                    roundAverages.push((values.reduce((a, b) => a + b, 0) / values.length).toFixed(1));
                } else {
                    roundAverages.push('N/A');
                }
            }
            const roundText = roundAverages.map((avg, i) => `R${i + 1}: \`${avg}\``).join('  ');

            const recentGames = scores.slice(0, 5);
            const recentText = recentGames.map(g => {
                const dateLabel = new Date(g.puzzleDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                return `${dateLabel}: **${g.finalScore}**`;
            }).join(' | ');

            const periodLabels = {
                all: 'All Time',
                year: 'This Year',
                month: 'This Month',
                week: 'This Week',
            };

            const embed = new EmbedBuilder()
                .setColor(0x1ABC9C)
                .setTitle(`🗺️ MapTap Stats: ${targetUser.username}`)
                .setDescription(`**${periodLabels[period]}**`)
                .addFields(
                    { name: '🎮 Games Played', value: totalGames.toString(), inline: true },
                    { name: '📈 Avg Score', value: avgScore.toString(), inline: true },
                    { name: '🏆 Best Score', value: bestScore.toString(), inline: true },
                    { name: '💀 Worst Score', value: worstScore.toString(), inline: true },
                    { name: '\n📊 Avg Score Per Round', value: roundText, inline: false },
                    { name: '🕐 Recent Games', value: recentText, inline: false },
                )
                .setTimestamp();

            const reply = await interaction.reply({ embeds: [embed], fetchReply: true });
            setTimeout(() => reply.delete().catch(() => {}), 5 * 60 * 1000);

        } catch (error) {
            console.error('Error fetching MapTap stats:', error);
            await interaction.reply({
                content: 'An error occurred while fetching MapTap stats.',
                flags: MessageFlags.Ephemeral,
            });
        }
    },
};
