import { logger, toErrorMeta } from "./logger.js";

const DEFAULT_WEBHOOK_PATH = "/telegram/webhook";

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}

function getWebhookPath(webhookUrl) {
  const configuredPath = process.env.WEBHOOK_PATH?.trim();

  if (configuredPath) {
    return configuredPath.startsWith("/") ? configuredPath : `/${configuredPath}`;
  }

  if (!webhookUrl) {
    return DEFAULT_WEBHOOK_PATH;
  }

  return new URL(webhookUrl).pathname || DEFAULT_WEBHOOK_PATH;
}

export async function startWebhookServer(bot, webhookUrl) {
  const port = Number(process.env.PORT || 3000);
  const webhookPath = getWebhookPath(webhookUrl);
  const secretToken = process.env.WEBHOOK_SECRET?.trim();

  await bot.telegram.setWebhook(webhookUrl, {
    secret_token: secretToken || undefined,
    drop_pending_updates: true
  });

  const server = Bun.serve({
    port,
    async fetch(request) {
      const url = new URL(request.url);

      if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
        return jsonResponse({
          ok: true,
          mode: "webhook",
          webhookPath
        });
      }

      if (request.method !== "POST" || url.pathname !== webhookPath) {
        return jsonResponse({ ok: false, error: "Not found" }, 404);
      }

      if (secretToken && request.headers.get("x-telegram-bot-api-secret-token") !== secretToken) {
        logger.warn("Webhook request rejected because secret token is invalid");
        return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
      }

      try {
        const update = await request.json();
        await bot.handleUpdate(update);
        return jsonResponse({ ok: true });
      } catch (error) {
        logger.error("Webhook update handling failed", toErrorMeta(error));
        return jsonResponse({ ok: false }, 500);
      }
    }
  });

  logger.info("Calorie Telegram bot is running with webhook", {
    port: server.port,
    webhookPath,
    model: process.env.OPENROUTER_MODEL || "default fallback"
  });

  return server;
}
