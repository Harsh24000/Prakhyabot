import 'dotenv/config';
import { Bot } from 'grammy';
import {
  handleStart,
  handleRestart,
  handleStatus,
  handlePause,
  handleMessage,
  handlePhoto,
  handleVoice,
  handleCallbackQuery,
  nudgeInactiveUsers,
} from './conversation.js';

if (!process.env.TELEGRAM_BOT_TOKEN) {
  console.error('Error: TELEGRAM_BOT_TOKEN is missing in .env');
  process.exit(1);
}
if (!process.env.GROQ_API_KEY) {
  console.error('Error: GROQ_API_KEY is missing in .env');
  process.exit(1);
}

const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN);

bot.catch((err) => {
  const ctx = err.ctx;
  console.error(`Error handling update ${ctx.update.update_id}:`);
  console.error(err.error);
});

// Commands
bot.command('start',   handleStart);
bot.command('restart', handleRestart);
bot.command('status',  handleStatus);
bot.command('pause',   handlePause);

// Message handlers
bot.on('message:text',  handleMessage);
bot.on('message:photo', handlePhoto);
bot.on('message:voice', handleVoice);   // voice note support

// All inline keyboard callbacks go through one handler
bot.on('callback_query:data', handleCallbackQuery);

// Catch-all for unsupported message types (stickers, documents, etc.)
bot.on('message', async (ctx) => {
  if (!ctx.message.text && !ctx.message.photo && !ctx.message.voice) {
    await ctx.reply("I can only process text, photos, and voice notes right now 😊");
  }
});

// Nudge inactive users every 30 minutes
setInterval(() => nudgeInactiveUsers(bot), 30 * 60 * 1000);

console.log('Starting Mealzy bot...');
bot.start({
  onStart: (info) => {
    console.log(`✅ Bot @${info.username} is live`);
    console.log(`🔔 Nudge system active — runs every 30 min`);
  },
});

process.once('SIGINT',  () => bot.stop());
process.once('SIGTERM', () => bot.stop());
