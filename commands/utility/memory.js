const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const userMemory = require('../../services/userMemory');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('memory')
    .setDescription('Manage what the bot remembers')
    .addSubcommand(sub =>
      sub
        .setName('view')
        .setDescription('View what the bot remembers about you or someone else')
        .addUserOption(option =>
          option
            .setName('user')
            .setDescription('User to check memories for (leave blank for yourself)')
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('forget')
        .setDescription('Make the bot forget a specific fact or preference')
        .addStringOption(option =>
          option
            .setName('type')
            .setDescription('What type of memory to forget')
            .setRequired(true)
            .addChoices(
              { name: 'Fact', value: 'fact' },
              { name: 'Preference', value: 'preference' }
            )
        )
        .addStringOption(option =>
          option
            .setName('item')
            .setDescription('The exact fact text or preference category name (from /memory view)')
            .setRequired(true)
        )
        .addUserOption(option =>
          option
            .setName('user')
            .setDescription('(Admin) Remove a memory for another user')
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('reload')
        .setDescription('(Admin) Reload memories from disk — use after manual edits while bot was stopped')
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'view') {
      const targetUser = interaction.options.getUser('user') || interaction.user;
      const summary = userMemory.getMemorySummary(targetUser.id);

      const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle(`🧠 Memory Bank: ${targetUser.username}`)
        .setThumbnail(targetUser.displayAvatarURL());

      embed.addFields({
        name: '📊 Stats',
        value: `Messages: ${summary.messageCount}\nDays known: ${summary.daysSinceFirstSeen}\nRoast Score: ${summary.roastScore > 0 ? '+' : ''}${summary.roastScore}`,
        inline: false
      });

      if (summary.facts.length > 0) {
        embed.addFields({
          name: '📝 Things I Remember',
          value: summary.facts.map(f => `• ${f}`).join('\n'),
          inline: false
        });
      }

      if (Object.keys(summary.preferences).length > 0) {
        const prefText = Object.entries(summary.preferences)
          .map(([key, val]) => `${key}: ${val}`)
          .join('\n');
        embed.addFields({
          name: '❤️ Preferences',
          value: prefText,
          inline: false
        });
      }

      if (summary.insideJokes.length > 0) {
        embed.addFields({
          name: '😂 Inside Jokes',
          value: summary.insideJokes.join(', '),
          inline: false
        });
      }

      if (summary.achievements.length > 0) {
        embed.addFields({
          name: '🎯 Achievements',
          value: summary.achievements.map(a => `🏆 ${a.name}`).join('\n'),
          inline: false
        });
      }

      if (summary.messageCount === 0) {
        embed.setDescription("I don't know this person yet! They're basically a stranger to me 👀");
      }

      await interaction.reply({ embeds: [embed] });

    } else if (sub === 'forget') {
      const type = interaction.options.getString('type');
      const item = interaction.options.getString('item');
      const targetUser = interaction.options.getUser('user');

      // Targeting another user requires admin permission
      if (targetUser && targetUser.id !== interaction.user.id) {
        const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild);
        if (!isAdmin) {
          await interaction.reply({ content: 'You need the **Manage Server** permission to modify someone else\'s memories.', flags: MessageFlags.Ephemeral });
          return;
        }
      }

      const userId = targetUser ? targetUser.id : interaction.user.id;
      const targetLabel = targetUser && targetUser.id !== interaction.user.id ? `${targetUser.username}'s` : 'your';

      let removed;
      if (type === 'fact') {
        removed = userMemory.removeFact(userId, item);
      } else {
        removed = userMemory.removePreference(userId, item);
      }

      if (removed) {
        await interaction.reply({ content: `Got it — I've removed that ${type} from ${targetLabel} memory: **${item}**`, flags: MessageFlags.Ephemeral });
      } else {
        await interaction.reply({
          content: `I couldn't find a ${type} matching **"${item}"** in ${targetLabel} memory. Use \`/memory view\` to see the exact text/category names.`,
          flags: MessageFlags.Ephemeral
        });
      }

    } else if (sub === 'reload') {
      const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild);
      if (!isAdmin) {
        await interaction.reply({ content: 'You need the **Manage Server** permission to reload memories.', flags: MessageFlags.Ephemeral });
        return;
      }

      userMemory.reloadMemories();
      await interaction.reply({ content: 'Memory reloaded from disk.', flags: MessageFlags.Ephemeral });
    }
  },
};
