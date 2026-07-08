const { Op } = require('sequelize');

const WORDLE_CHANNEL_ID = '930279618437586974';
const REMINDER_HOUR = 21; // 9pm, server local time
const CHECK_INTERVAL_MS = 5 * 60 * 1000;

let lastReminderDate = null;

function getStartOfToday() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

async function sendReminders(client) {
    const now = new Date();
    const todayKey = now.toDateString();

    if (lastReminderDate === todayKey) return;
    if (now.getHours() < REMINDER_HOUR) return;

    lastReminderDate = todayKey;

    try {
        const { WordleReminderOptIn, WordleScore } = client.models;

        const optedIn = await WordleReminderOptIn.findAll();
        if (optedIn.length === 0) return;

        const submittedToday = await WordleScore.findAll({
            where: {
                userId: { [Op.in]: optedIn.map(o => o.userId) },
                postedAt: { [Op.gte]: getStartOfToday() },
            },
            attributes: ['userId'],
        });
        const submittedSet = new Set(submittedToday.map(s => s.userId));

        const missing = optedIn.filter(o => !submittedSet.has(o.userId));
        if (missing.length === 0) return;

        const channel = await client.channels.fetch(WORDLE_CHANNEL_ID);
        if (!channel) return;

        const mentions = missing.map(o => `<@${o.userId}>`).join(' ');
        await channel.send(`⏰ ${mentions} — you haven't posted today's Wordle result yet. Don't break your streak!`);
    } catch (error) {
        console.error('Error sending Wordle reminders:', error);
    }
}

function startWordleReminderScheduler(client) {
    setInterval(() => sendReminders(client), CHECK_INTERVAL_MS);
    // Catch the case where the bot starts (or restarts) after 9pm with nothing sent yet
    sendReminders(client);
}

module.exports = { startWordleReminderScheduler };
