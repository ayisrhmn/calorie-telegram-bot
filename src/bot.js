import "dotenv/config";
import { Telegraf } from "telegraf";
import { formatCalorieResult, formatRawFallback } from "./formatter.js";
import { logger, toErrorMeta } from "./logger.js";
import { estimateCaloriesFromImage } from "./openrouter.js";

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  throw new Error("TELEGRAM_BOT_TOKEN is required");
}

const bot = new Telegraf(token);

async function getHighestResolutionPhotoUrl(ctx) {
  const photos = ctx.message?.photo || [];
  const highestResolutionPhoto = photos.at(-1);

  if (!highestResolutionPhoto?.file_id) {
    return null;
  }

  const fileLink = await ctx.telegram.getFileLink(highestResolutionPhoto.file_id);
  return fileLink.href;
}

bot.start((ctx) => {
  logger.info("Start command received", {
    chatId: ctx.chat?.id,
    userId: ctx.from?.id
  });

  return ctx.reply("Halo! Kirim foto makanan ya, nanti aku bantu estimasi kalorinya.");
});

bot.help((ctx) => {
  logger.info("Help command received", {
    chatId: ctx.chat?.id,
    userId: ctx.from?.id
  });

  return ctx.reply("Kirim satu foto makanan. Aku akan coba hitung estimasi kalori dari fotonya.");
});

bot.on("photo", async (ctx) => {
  logger.info("Photo message received", {
    chatId: ctx.chat?.id,
    userId: ctx.from?.id,
    photoSizes: ctx.message?.photo?.length || 0
  });

  const loadingMessage = await ctx.reply("Sebentar ya, lagi aku cek kalorinya...");

  try {
    const imageUrl = await getHighestResolutionPhotoUrl(ctx);

    if (!imageUrl) {
      logger.warn("Photo message did not include a usable file id", {
        chatId: ctx.chat?.id,
        userId: ctx.from?.id
      });
      await ctx.reply("Kirim foto makanan ya.");
      return;
    }

    logger.info("Telegram file URL resolved", {
      chatId: ctx.chat?.id,
      userId: ctx.from?.id
    });

    const result = await estimateCaloriesFromImage(imageUrl);

    if (!result.parsed) {
      logger.warn("AI response is not valid JSON", {
        model: result.model,
        rawLength: result.rawText.length
      });
      await ctx.reply(formatRawFallback(result.rawText), { parse_mode: "HTML" });
      return;
    }

    logger.info("Calorie estimation completed", {
      model: result.model,
      items: Array.isArray(result.parsed.items) ? result.parsed.items.length : 0,
      totalCalories: result.parsed.total_calories,
      confidence: result.parsed.confidence
    });

    await ctx.reply(formatCalorieResult(result.parsed), { parse_mode: "HTML" });
  } catch (error) {
    logger.error("Failed to estimate calories", {
      ...toErrorMeta(error),
      attempts: error.errors
    });
    await ctx.reply("Lagi kena limit/coba lagi nanti.");
  } finally {
    try {
      await ctx.deleteMessage(loadingMessage.message_id);
    } catch {
      // Ignore cleanup failures because the main response is more important.
    }
  }
});

bot.on("message", (ctx) => {
  logger.info("Non-photo message received", {
    chatId: ctx.chat?.id,
    userId: ctx.from?.id,
    messageType: Object.keys(ctx.message || {}).find((key) => key !== "message_id")
  });
  return ctx.reply("Kirim foto makanan ya.");
});

bot.catch((error) => {
  logger.error("Bot error", toErrorMeta(error));
});

bot.launch();

logger.info("Calorie Telegram bot is running with polling", {
  model: process.env.OPENROUTER_MODEL || "default fallback"
});

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
