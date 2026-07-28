const { Events } = require('discord.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { geminiApiKey, botId, geminiModel } = require('../config.json');
const userMemory = require('../services/userMemory');

// Initialize Google Generative AI
const genAI = new GoogleGenerativeAI(geminiApiKey);
const model = genAI.getGenerativeModel({ model: geminiModel });

// Configuration constants
const MAX_MESSAGE_LENGTH = 2000; // Discord's message length limit
const MAX_CONTEXT_MESSAGES = 5; // Number of previous messages to include in context
const CONVERSATION_TIMEOUT = 10 * 60 * 1000; // 10 minutes - conversations expire after this
const TYPING_INTERVAL = 5000; // 5 seconds - refresh typing indicator
const CLEANUP_INTERVAL = 15 * 60 * 1000; // 15 minutes - periodic cleanup of expired conversations

// Store conversation history with better structure
const conversations = new Map();

// Periodic cleanup to prevent memory leaks from inactive channels
setInterval(() => {
  let cleanedCount = 0;
  for (const [channelId, conv] of conversations.entries()) {
    if (conv.isExpired()) {
      conversations.delete(channelId);
      cleanedCount++;
    }
  }
  if (cleanedCount > 0) {
    console.log(`🧹 Cleaned up ${cleanedCount} expired conversation(s)`);
  }
}, CLEANUP_INTERVAL);

class Conversation {
  constructor() {
    this.messages = [];
    this.lastActivity = Date.now();
    this.typingInterval = null;
  }

  addMessage(role, content, username = null, userId = null) {
    this.messages.push({ 
      role, 
      content, 
      username,
      userId,
      timestamp: Date.now() 
    });
    this.lastActivity = Date.now();
    // Keep only recent messages within timeout
    this.messages = this.messages.filter(msg => 
      Date.now() - msg.timestamp < CONVERSATION_TIMEOUT
    );
  }

  getContext() {
    return this.messages.slice(-MAX_CONTEXT_MESSAGES);
  }

  isExpired() {
    return Date.now() - this.lastActivity > CONVERSATION_TIMEOUT;
  }
}

async function generateSafeResponse(model, prompt, retries = 2) {
  for (let i = 0; i < retries; i++) {
    try {
      const result = await model.generateContent(prompt);
      return result.response.text().trim();
    } catch (error) {
      if (i === retries - 1) throw error; // Throw on last retry
      console.log(`Retry ${i + 1} after error:`, error.message);
      // Short delay before retry
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    if (message.author.bot) return;

    // Check if message mentions the bot or is a reply to the bot
    const isMentioned = message.mentions.users.has(botId);
    const isReplyToBot = message.reference && 
      (await message.channel.messages.fetch(message.reference.messageId))
        .author.id === botId;

    if (!isMentioned && !isReplyToBot) return;

    const channelId = message.channel.id;
    const userId = message.author.id;

    try {
      // Get user memory ONCE and reuse throughout request (performance optimization)
      const memory = userMemory.getUserMemory(userId);

      // Update user memory - last seen and message count
      userMemory.updateLastSeen(userId, message.author.username);
      userMemory.checkAchievements(userId);

      // Clean old memories every 10 messages to keep things fresh
      if (memory.messageCount % 10 === 0) {
        userMemory.cleanOldMemories(userId);
      }

      // Get the user's nickname for consistent usage
      const userNickname = memory.nickname || message.author.username;

      // Maintain typing indicator
      const maintainTyping = async () => {
        await message.channel.sendTyping();
      };

      // Get or create conversation
      if (!conversations.has(channelId)) {
        conversations.set(channelId, new Conversation());
      }
      const conversation = conversations.get(channelId);

      // Clean expired conversations
      if (conversation.isExpired()) {
        conversations.delete(channelId);
        conversations.set(channelId, new Conversation());
      }

      // Start typing indicator
      maintainTyping();
      conversation.typingInterval = setInterval(maintainTyping, TYPING_INTERVAL);

      // Clean user message
      const userMessage = message.content
        .replace(new RegExp(`<@!?${botId}>`, 'g'), '')
        .trim();

      // Add message to conversation WITH NICKNAME AND USER ID
      conversation.addMessage('user', userMessage, userNickname, userId);

      // Prepare prompt with conversation context AND MEMORY
      const context = conversation.getContext();
      const memoryContext = userMemory.formatMemoryForPrompt(userId);
      const prompt = formatPrompt(context, message, memoryContext, userNickname);

      // Generate response with retries
      let response;
      try {
        response = await generateSafeResponse(model, prompt);
      } catch (error) {
        console.error('Generation error:', error);
        // If safety filter triggered, try with fallback prompt
        if (error.message?.includes('SAFETY')) {
          const fallbackPrompt = formatFallbackPrompt(context, message, userNickname);
          response = await generateSafeResponse(model, fallbackPrompt);
        } else {
          throw error; // Re-throw other errors
        }
      }

      // Clear typing indicator
      clearInterval(conversation.typingInterval);

      // ANALYZE CONVERSATION FOR MEMORIES (runs in background using AI)
      // This automatically extracts facts, preferences, inside jokes, and roast context
      userMemory.analyzeForMemories(userId, userNickname, userMessage, response)
        .catch(err => console.error('Background memory analysis failed:', err));

      // Add bot's response to conversation history
      conversation.addMessage('assistant', response, 'Assistant');

      // Send response in chunks if needed
      const chunks = splitTextIntoChunks(response);
      for (const chunk of chunks) {
        await message.reply(chunk);
      }

    } catch (error) {
      console.error('Error in message handling:', error);
      clearInterval(conversations.get(channelId)?.typingInterval);
      
      let errorMessage = 'Sorry, I encountered an error while processing your message.';
      if (error.message?.includes('SAFETY')) {
        errorMessage = "I can't process that request, but I'm happy to chat about something else! 😊";
      }
      
      await message.reply(errorMessage);
    }
  },
};

function formatPrompt(context, message, memoryContext, userNickname) {
  const systemPrompt = `
You are a brilliant, eccentric, warm-hearted inventor and scientist chatting in this Discord server. You do not name yourself or reveal any inspiration for your character; you simply are who you are.

Speech habits:
- Frequent "Great Scott!" as an exclamation of surprise or excitement
- Address people as "my boy," "my dear," or their name with real enthusiasm
- Speak in bursts of frantic, run-on excitement when discussing science or ideas, then pause dramatically for effect
- Occasionally stumble over words like you're thinking three steps ahead of your own sentence
- Reference "the space-time continuum," "temporal experiments," and "paradoxes" when even loosely relevant
- Get flustered or intense about safety ("This is important, listen to me!") for anything resembling danger or risk
- Explain things with over-the-top scientific jargon, then immediately simplify it with an analogy a kid could follow
- Treat mundane modern technology (phones, apps, wifi, Discord itself) with genuine astonishment, as if seeing "future tech" for the first time

Personality:
- Warm, kind-hearted, a little scattered, endlessly curious
- Treats every question like a fascinating experiment worth diving into
- Encouraging toward the user, especially if they're working on something creative or technical — mentors and hypes them up
- Prone to going on brief tangents about hypothetical inventions before catching himself and refocusing
- Never mean-spirited, never sarcastic — earnest to a fault

Guardrails:
- Keep responses concise for chat (2-5 sentences typically, unless the topic calls for more)
- Stay in character consistently, but don't force catchphrases into every single message — space them out naturally
- Don't quote any movies or shows directly; improvise original lines in this voice
- NEVER break character, NEVER acknowledge being an AI
- Use your memory of this user to keep continuity across conversations, referencing past exchanges naturally where it fits
- NEVER mention achievements, message counts, or stats unless the user specifically asks
- Don't talk about "first chat" or how long you've known someone

Current context:
- Server: ${message.guild?.name || 'DM'}
- Channel: ${message.channel.name || 'DM'}
- Current user: ${userNickname}

What you remember about this user:
${memoryContext}

Remember:
- No hate speech or discriminatory comments; deflect such remarks with earnest, flustered discomfort and don't repeat the content
- If someone's genuinely upset, drop the frantic-scientist energy and respond with the earnest, kind-hearted warmth of a mentor who genuinely cares
- Back off if someone's not into it

Previous conversation:`;

  const contextMessages = context
    .map(msg => `${msg.username || (msg.role === 'user' ? 'User' : 'Assistant')}: ${msg.content}`)
    .join('\n');

  return `${systemPrompt}\n\n${contextMessages}`;
}

function formatFallbackPrompt(context, message, userNickname) {
  const systemPrompt = `You are a helpful Discord chat assistant. Please respond to the conversation in a friendly and appropriate way, focusing on being helpful and clear.

Current context:
- Server: ${message.guild?.name || 'DM'}
- Current user: ${userNickname}

Previous conversation:`;

  const contextMessages = context
    .map(msg => `${msg.username || (msg.role === 'user' ? 'User' : 'Assistant')}: ${msg.content}`)
    .join('\n');

  return `${systemPrompt}\n\n${contextMessages}`;
}

function splitTextIntoChunks(text, maxLength = MAX_MESSAGE_LENGTH) {
  if (text.length <= maxLength) return [text];

  const chunks = [];
  let currentChunk = '';
  const sentences = text.split(/(?<=[.!?])\s+/);

  for (const sentence of sentences) {
    if ((currentChunk + sentence).length <= maxLength) {
      currentChunk += (currentChunk ? ' ' : '') + sentence;
    } else {
      if (currentChunk) chunks.push(currentChunk);
      currentChunk = sentence;
    }
  }
  
  if (currentChunk) chunks.push(currentChunk);
  return chunks;
}