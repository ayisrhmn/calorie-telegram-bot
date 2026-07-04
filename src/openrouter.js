import axios from "axios";
import { logger, toErrorMeta } from "./logger.js";
import { CALORIE_ESTIMATION_PROMPT } from "./prompts.js";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export const FALLBACK_MODELS = [
  "google/gemma-4-31b-it:free",
  "google/gemma-4-26b-a4b-it:free",
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
  "nvidia/nemotron-nano-12b-v2-vl:free"
];

function getModels() {
  const configuredModel = process.env.OPENROUTER_MODEL?.trim();
  return [...new Set([configuredModel, ...FALLBACK_MODELS].filter(Boolean))];
}

function extractText(responseData) {
  const content = responseData?.choices?.[0]?.message?.content;

  if (typeof content === "string") {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => part?.text || "")
      .join("")
      .trim();
  }

  return "";
}

function stripJsonFence(text) {
  return text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

export function parseJsonSafely(text) {
  const cleaned = stripJsonFence(text);

  try {
    return JSON.parse(cleaned);
  } catch {
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");

    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      return null;
    }

    try {
      return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
    } catch {
      return null;
    }
  }
}

async function requestModel({ apiKey, model, imageUrl }) {
  logger.info("OpenRouter request started", { model });

  const response = await axios.post(
    OPENROUTER_URL,
    {
      model,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: CALORIE_ESTIMATION_PROMPT
            },
            {
              type: "image_url",
              image_url: {
                url: imageUrl
              }
            }
          ]
        }
      ],
      temperature: 0.2,
      response_format: {
        type: "json_object"
      }
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://github.com/ayisrhmn/calorie-telegram-bot",
        "X-Title": "Calorie Telegram Bot"
      },
      timeout: 60000
    }
  );

  logger.info("OpenRouter request completed", {
    model,
    status: response.status
  });

  return extractText(response.data);
}

export async function estimateCaloriesFromImage(imageUrl) {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is required");
  }

  const errors = [];

  for (const model of getModels()) {
    try {
      const rawText = await requestModel({ apiKey, model, imageUrl });
      const parsed = parseJsonSafely(rawText);

      logger.info("OpenRouter model returned response", {
        model,
        jsonValid: Boolean(parsed),
        rawLength: rawText.length
      });

      return {
        model,
        rawText,
        parsed
      };
    } catch (error) {
      errors.push({
        model,
        status: error.response?.status,
        message: error.response?.data?.error?.message || error.message
      });
      logger.warn("OpenRouter model failed, trying fallback", {
        model,
        ...toErrorMeta(error),
        providerMessage: error.response?.data?.error?.message
      });
    }
  }

  const error = new Error("All OpenRouter models failed");
  error.errors = errors;
  throw error;
}
