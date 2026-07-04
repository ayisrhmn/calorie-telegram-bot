import { createServer } from "node:http";
import { logger, toErrorMeta } from "./logger.js";

const DEFAULT_WEBHOOK_PATH = "/telegram/webhook";

function sendJson(response, body, status = 200) {
  response.writeHead(status, {
    "Content-Type": "application/json"
  });
  response.end(JSON.stringify(body));
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk;
    });

    request.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch (error) {
        reject(error);
      }
    });

    request.on("error", reject);
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

  const server = createServer(async (request, response) => {
    const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);

    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
      sendJson(response, {
        ok: true,
        mode: "webhook",
        webhookPath
      });
      return;
    }

    if (request.method !== "POST" || url.pathname !== webhookPath) {
      sendJson(response, { ok: false, error: "Not found" }, 404);
      return;
    }

    if (secretToken && request.headers["x-telegram-bot-api-secret-token"] !== secretToken) {
      logger.warn("Webhook request rejected because secret token is invalid");
      sendJson(response, { ok: false, error: "Unauthorized" }, 401);
      return;
    }

    try {
      const update = await readJsonBody(request);
      await bot.handleUpdate(update);
      sendJson(response, { ok: true });
    } catch (error) {
      logger.error("Webhook update handling failed", toErrorMeta(error));
      sendJson(response, { ok: false }, 500);
    }
  });

  await new Promise((resolve) => server.listen(port, resolve));

  logger.info("Calorie Telegram bot is running with webhook", {
    port: server.address().port,
    webhookPath,
    model: process.env.OPENROUTER_MODEL || "default fallback"
  });

  return server;
}
