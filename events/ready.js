const { Events } = require('discord.js');
const userMemory = require('../services/userMemory');
const { startWordleReminderScheduler } = require('../services/wordleReminderScheduler');

function sweepAllMemories() {
	const userIds = userMemory.getAllUserIds();
	let cleaned = 0;
	userIds.forEach(id => {
		if (userMemory.cleanOldMemories(id)) cleaned++;
	});
	if (cleaned > 0) console.log(`🧹 Memory sweep cleaned entries for ${cleaned} user(s)`);
}

module.exports = {
	name: Events.ClientReady,
	once: true,
	execute(client) {
		console.log(`Ready! Logged in as ${client.user.tag}`);

		// Sweep expired memories for all known users on startup
		sweepAllMemories();

		// Run daily so stale entries are removed without needing a bot restart
		const ONE_DAY_MS = 24 * 60 * 60 * 1000;
		setInterval(sweepAllMemories, ONE_DAY_MS);

		// Periodically check for opted-in users who haven't posted their Wordle by 9pm
		startWordleReminderScheduler(client);
	},
};