/**
 * Telegram sticker file IDs for Mealzy bot.
 *
 * HOW TO GET REAL FILE IDs:
 * 1. Find a sticker pack on Telegram you like
 * 2. Forward any sticker to @RawDataBot
 * 3. Copy the file_id from the bot's response
 * 4. Add it to your .env file (keys below)
 * 5. Set STICKERS_ENABLED=true in .env
 *
 * .env keys:
 *   STICKERS_ENABLED=true
 *   STICKER_WAVE=CAACAgIA...
 *   STICKER_FIRE=CAACAgIA...
 *   STICKER_CELEBRATE=CAACAgIA...
 *   STICKER_THINKING=CAACAgIA...
 *   STICKER_LOVE=CAACAgIA...
 *   STICKER_MUSCLE=CAACAgIA...
 */

const ENABLED = process.env.STICKERS_ENABLED === 'true';

const FILE_IDS = {
  wave:      process.env.STICKER_WAVE      || '',
  fire:      process.env.STICKER_FIRE      || '',
  celebrate: process.env.STICKER_CELEBRATE || '',
  thinking:  process.env.STICKER_THINKING  || '',
  love:      process.env.STICKER_LOVE      || '',
  muscle:    process.env.STICKER_MUSCLE    || '',
};

/**
 * Send a sticker. Silently skips if not configured or disabled.
 * @param {import('grammy').Context} ctx
 * @param {'wave'|'fire'|'celebrate'|'thinking'|'love'|'muscle'} name
 */
export async function sendSticker(ctx, name) {
  if (!ENABLED) return;
  const fileId = FILE_IDS[name];
  if (!fileId) return;
  try {
    await ctx.replyWithSticker(fileId);
  } catch (err) {
    // Sticker failures should never crash the bot
    console.error(`[Sticker] Failed to send "${name}":`, err.message);
  }
}
