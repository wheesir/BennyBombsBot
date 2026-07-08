const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { Sequelize } = require('sequelize');
const sequelize = require('../../db.js');
const OutOfContext = require('../../models/OutOfContext')(sequelize, Sequelize.DataTypes);

// Discord message link regex
const MESSAGE_LINK_REGEX = /https:\/\/(?:ptb\.|canary\.)?discord(?:app)?\.com\/channels\/(\d+)\/(\d+)\/(\d+)/;

module.exports = {
	data: new SlashCommandBuilder()
		.setName('outofcontext')
		.setDescription('Save and retrieve hilarious out-of-context quotes')
		.addSubcommand(subcommand =>
			subcommand
				.setName('add')
				.setDescription('Add a new out-of-context quote')
				.addStringOption(option =>
					option
						.setName('message_link')
						.setDescription('Discord message link (right-click message > Copy Message Link)')
						.setRequired(true)
				)
		)
		.addSubcommand(subcommand =>
			subcommand
				.setName('random')
				.setDescription('Get a random out-of-context quote')
				.addUserOption(option =>
					option
						.setName('user')
						.setDescription('Filter by a specific user (optional)')
						.setRequired(false)
				)
		)
		.addSubcommand(subcommand =>
			subcommand
				.setName('list')
				.setDescription('List quotes from a user')
				.addUserOption(option =>
					option
						.setName('user')
						.setDescription('Whose quotes to list')
						.setRequired(true)
				)
		)
		.addSubcommand(subcommand =>
			subcommand
				.setName('leaderboard')
				.setDescription('See who\'s been quoted the most')
		)
		.addSubcommand(subcommand =>
			subcommand
				.setName('delete')
				.setDescription('Delete a quote by ID (only if you added it)')
				.addIntegerOption(option =>
					option
						.setName('id')
						.setDescription('The quote ID to delete')
						.setRequired(true)
				)
		),

	async execute(interaction) {
		const subcommand = interaction.options.getSubcommand();

		if (subcommand === 'add') {
			const messageLink = interaction.options.getString('message_link');

			// Validate message link format
			const match = messageLink.match(MESSAGE_LINK_REGEX);
			if (!match) {
				return interaction.reply({
					content: "That doesn't look like a valid Discord message link. Right-click a message and select 'Copy Message Link'. 🔗",
					flags: MessageFlags.Ephemeral,
				});
			}

			const [, guildId, channelId, messageId] = match;

			// Check if link is from this server
			if (guildId !== interaction.guildId) {
				return interaction.reply({
					content: "That message is from a different server. Keep the quotes local! 🏠",
					flags: MessageFlags.Ephemeral,
				});
			}

			await interaction.deferReply();

			try {
				// Fetch the channel and message
				const channel = await interaction.client.channels.fetch(channelId);
				if (!channel) {
					return interaction.editReply({
						content: "Couldn't find that channel. Maybe it was deleted? 👻",
					});
				}

				const message = await channel.messages.fetch(messageId);
				if (!message) {
					return interaction.editReply({
						content: "Couldn't find that message. It may have been deleted. 💨",
					});
				}

				// Don't let people quote themselves
				if (message.author.id === interaction.user.id) {
					return interaction.editReply({
						content: "You can't quote yourself, that's just sad. 😬",
					});
				}

				// Don't quote bots
				if (message.author.bot) {
					return interaction.editReply({
						content: "Quoting bots? Really? Touch grass. 🌿",
					});
				}

				// Get message content
				let quote = message.content;
				if (!quote && message.attachments.size > 0) {
					quote = '[Attachment]';
				}
				if (!quote && message.embeds.length > 0) {
					quote = '[Embed]';
				}
				if (!quote) {
					quote = '[No text content]';
				}

				// Truncate if too long
				if (quote.length > 500) {
					quote = quote.substring(0, 497) + '...';
				}

				const newQuote = await OutOfContext.create({
					quote: quote,
					quotedUserId: message.author.id,
					quotedUsername: message.author.username,
					addedByUserId: interaction.user.id,
					addedByUsername: interaction.user.username,
					guildId: interaction.guildId,
				});

				const embed = new EmbedBuilder()
					.setColor('#FF6B6B')
					.setTitle('📝 Quote Added!')
					.setDescription(`"${quote}"`)
					.addFields(
						{ name: 'Said by', value: `<@${message.author.id}>`, inline: true },
						{ name: 'Added by', value: `${interaction.user}`, inline: true },
						{ name: 'Quote ID', value: `#${newQuote.id}`, inline: true },
						{ name: 'Message Link', value: `[Jump to message](${messageLink})`, inline: true }
					)
					.setFooter({ text: 'No context allowed 🤫 • This message will self-destruct in 5 minutes' })
					.setTimestamp();

				const reply = await interaction.editReply({ embeds: [embed], fetchReply: true });

				// Delete after 5 minutes
				setTimeout(() => {
					reply.delete().catch(() => {});
				}, 5 * 60 * 1000);
			} catch (error) {
				console.error('Error adding quote:', error);
				await interaction.editReply({
					content: 'Something broke while saving that quote. Probably your fault. 🙄',
				});
			}
		}

		else if (subcommand === 'random') {
			const filterUser = interaction.options.getUser('user');

			try {
				const whereClause = { guildId: interaction.guildId };
				if (filterUser) {
					whereClause.quotedUserId = filterUser.id;
				}

				const quote = await OutOfContext.findOne({
					where: whereClause,
					order: sequelize.random(),
				});

				if (!quote) {
					const message = filterUser
						? `No quotes found for ${filterUser.username}. They must be boring. 😴`
						: "No quotes yet! Y'all need to say more unhinged things. 🤪";
					return interaction.reply({ content: message });
				}

				const embed = new EmbedBuilder()
					.setColor('#9B59B6')
					.setTitle('🎲 Random Out-of-Context Quote')
					.setDescription(`"${quote.quote}"`)
					.addFields(
						{ name: 'Said by', value: `<@${quote.quotedUserId}>`, inline: true },
						{ name: 'Quote ID', value: `#${quote.id}`, inline: true }
					)
					.setFooter({ text: `Added by ${quote.addedByUsername}` })
					.setTimestamp(quote.createdAt);

				await interaction.reply({ embeds: [embed] });
			} catch (error) {
				console.error('Error fetching random quote:', error);
				await interaction.reply({
					content: 'Failed to fetch a quote. The database is judging you. 👀',
					flags: MessageFlags.Ephemeral,
				});
			}
		}

		else if (subcommand === 'list') {
			const targetUser = interaction.options.getUser('user');

			try {
				const quotes = await OutOfContext.findAll({
					where: {
						guildId: interaction.guildId,
						quotedUserId: targetUser.id,
					},
					order: [['createdAt', 'DESC']],
					limit: 10,
				});

				if (quotes.length === 0) {
					return interaction.reply({
						content: `No quotes found for ${targetUser.username}. Suspiciously normal... 🤔`,
					});
				}

				const totalCount = await OutOfContext.count({
					where: {
						guildId: interaction.guildId,
						quotedUserId: targetUser.id,
					},
				});

				const quoteList = quotes
					.map((q, i) => `**#${q.id}** "${q.quote}"`)
					.join('\n\n');

				const embed = new EmbedBuilder()
					.setColor('#3498DB')
					.setTitle(`📜 Quotes from ${targetUser.username}`)
					.setThumbnail(targetUser.displayAvatarURL())
					.setDescription(quoteList)
					.setFooter({ text: `Showing ${quotes.length} of ${totalCount} total quotes` });

				await interaction.reply({ embeds: [embed] });
			} catch (error) {
				console.error('Error listing quotes:', error);
				await interaction.reply({
					content: 'Failed to list quotes. Try again when Mercury is out of retrograde. 🌙',
					flags: MessageFlags.Ephemeral,
				});
			}
		}

		else if (subcommand === 'leaderboard') {
			try {
				const leaderboard = await OutOfContext.findAll({
					where: { guildId: interaction.guildId },
					attributes: [
						'quotedUserId',
						'quotedUsername',
						[sequelize.fn('COUNT', sequelize.col('quotedUserId')), 'quoteCount'],
					],
					group: ['quotedUserId', 'quotedUsername'],
					order: [[sequelize.literal('quoteCount'), 'DESC']],
					limit: 10,
				});

				if (leaderboard.length === 0) {
					return interaction.reply({
						content: "No quotes yet! This server is disappointingly normal. 😐",
					});
				}

				const medals = ['🥇', '🥈', '🥉'];
				const leaderboardText = leaderboard
					.map((entry, index) => {
						const medal = medals[index] || `**${index + 1}.**`;
						const count = entry.dataValues.quoteCount;
						return `${medal} <@${entry.quotedUserId}> - **${count}** quote${count !== 1 ? 's' : ''}`;
					})
					.join('\n');

				const totalQuotes = await OutOfContext.count({
					where: { guildId: interaction.guildId },
				});

				const embed = new EmbedBuilder()
					.setColor('#F1C40F')
					.setTitle('🏆 Out-of-Context Hall of Fame')
					.setDescription(leaderboardText)
					.setFooter({ text: `${totalQuotes} total quotes in this server` })
					.setTimestamp();

				await interaction.reply({ embeds: [embed] });
			} catch (error) {
				console.error('Error fetching leaderboard:', error);
				await interaction.reply({
					content: 'Leaderboard machine broke. 🔧',
					flags: MessageFlags.Ephemeral,
				});
			}
		}

		else if (subcommand === 'delete') {
			const quoteId = interaction.options.getInteger('id');

			try {
				const quote = await OutOfContext.findOne({
					where: {
						id: quoteId,
						guildId: interaction.guildId,
					},
				});

				if (!quote) {
					return interaction.reply({
						content: `Quote #${quoteId} doesn't exist. Nice try though. 🕵️`,
						flags: MessageFlags.Ephemeral,
					});
				}

				// Only the person who added it can delete it
				if (quote.addedByUserId !== interaction.user.id) {
					return interaction.reply({
						content: `Only ${quote.addedByUsername} can delete this quote. No quote theft allowed. 🚫`,
						flags: MessageFlags.Ephemeral,
					});
				}

				await quote.destroy();

				await interaction.reply({
					content: `Quote #${quoteId} has been yeeted into the void. 🕳️`,
				});
			} catch (error) {
				console.error('Error deleting quote:', error);
				await interaction.reply({
					content: 'Failed to delete. The quote has become too powerful. 💀',
					flags: MessageFlags.Ephemeral,
				});
			}
		}
	},
};
