# BennyBombsBot

A Discord bot built with discord.js v14 for server games, memes, AI chat, Wordle tracking, stock lookups, and more.

## Features

- **Games** - Good Morning Crypto (GMC) daily game, slot machine, Boot Jaf tracking
- **AI Integration** - Google Gemini-powered chat responses, AI image generation via OpenAI, conversation summaries
- **Wordle Tracking** - Automatic score detection, personal stats, and server-wide leaderboards
- **Social** - Nomination system, out-of-context quote saving, XP/leveling system with leaderboards
- **Finance** - Stock quotes via Yahoo Finance, crypto via CoinMarketCap
- **Fun** - Meme/inside-joke commands, GIF lookups, image responses
- **Utility** - Message pruning, date countdowns, server/user info
- **User Memory** - The bot remembers things about users across conversations

## Commands

| Category | Command | Description |
|----------|---------|-------------|
| **Games** | `/gmc` | Good Morning Crypto game |
| | `/gmcstats` | GMC stats and leaderboard |
| | `/gac` | Generate a Lucas excuse |
| | `/slot` | Slot machine game |
| | `/bootjaf` | Count the times we boot jaf |
| | `/bootjafboard` | Boot Jaf leaderboard |
| | `/jafchart` | Jaf fun chart |
| **Wordle** | `/wordlestats` | View your Wordle statistics |
| | `/wordleleaderboard` | Server Wordle leaderboard |
| | `/wordlesync` | Import historical Wordle scores (Admin) |
| **Social** | `/nominate` | Nominate users for awards |
| | `/outofcontext` | Save/retrieve out-of-context quotes |
| | `/leaderboard` | Top 15 users by XP and level |
| | `/levelup-message` | View level-up trigger messages |
| **Finance** | `/stonk` | Stock/crypto price lookup |
| | `/doesrynbill` | Does Ryn bill? |
| **Utility** | `/tldr` | Snarky summary of recent conversation |
| | `/image` | Generate an image from a prompt |
| | `/gif` | Random GIF picker |
| | `/memory` | View what the bot remembers about a user |
| | `/days` | Days until a future date |
| | `/fridaythen` | It's Friday Then |
| | `/prune` | Prune up to 99 messages |
| | `/ping` | Pong! |
| | `/help` | Show help menu |
| | `/server` | Server info |
| | `/user` | User info |
| **Fun** | `/dallas` | Well that's Dallas |
| | `/supeson` | Random son gif |
| | `/kim` | You know what it is |
| | `/mel` | Mella Yellin |
| | `/weapprove` | Your supes approve |
| | `/vaccination` | What is it good for? |
| | `/ryn` | Ryn gif |
| | `/peg` | Peg? |
| | `/this` | ^^^^^^^^^^ |
| | `/idk` | I don't know what that means |

## Tech Stack

- **Runtime:** Node.js
- **Framework:** discord.js v14
- **Database:** PostgreSQL via Sequelize ORM
- **AI:** Google Generative AI (Gemini), OpenAI
- **APIs:** Yahoo Finance, CoinMarketCap, Tenor, GIPHY

## Project Structure

```
BennyBombsBot/
├── bot.js                  # Entry point - loads commands, events, models
├── deploy-commands.js      # Slash command deployment CLI
├── db.js                   # Sequelize database connection
├── commands/
│   ├── fun/                # Meme/joke one-liner commands
│   ├── games/              # GMC, slot, bootjaf, GAC
│   ├── wordle/             # Wordle stats, leaderboard, sync
│   ├── social/             # Nominations, out-of-context, leaderboard
│   ├── utility/            # Info, moderation, AI tools
│   └── finance/            # Stock and crypto lookups
├── events/                 # Discord event handlers (XP, Wordle tracking, AI chat)
├── models/                 # Sequelize model definitions
├── services/               # Business logic (user memory system)
├── utils/                  # Shared utilities (nickname cache, emoji data)
├── assets/
│   └── images/             # Static image assets
└── config/                 # Google credentials
```

## Setup

### Prerequisites

- Node.js v16.9+
- PostgreSQL database
- A [Discord bot token](https://discord.com/developers/applications)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/bglaszcz/BennyBombsBot.git
   cd BennyBombsBot
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure the bot:**

   Create a `config.json` in the project root:
   ```json
   {
     "token": "YOUR_DISCORD_BOT_TOKEN",
     "clientId": "YOUR_BOT_CLIENT_ID",
     "guildId": "YOUR_TEST_SERVER_ID",
     "geminiApiKey": "YOUR_GEMINI_API_KEY",
     "geminiModel": "gemini-model-name",
     "chatGptKey": "YOUR_OPENAI_API_KEY",
     "botId": "YOUR_BOT_USER_ID",
     "tenorApiKey": "YOUR_TENOR_API_KEY",
     "GIPHYApiKey": "YOUR_GIPHY_API_KEY"
   }
   ```

4. **Deploy slash commands:**
   ```bash
   # Deploy to a test server (instant)
   npm run deploy

   # Deploy globally (takes up to 1 hour to propagate)
   npm run deploy:global
   ```

5. **Start the bot:**
   ```bash
   npm start
   ```

### Other Scripts

```bash
npm run deploy:delete   # Remove all deployed commands
```

## License

ISC
