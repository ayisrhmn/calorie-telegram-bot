# Calorie Telegram Bot

Telegram bot MVP for estimating food calories from photos using Bun, Telegraf, and OpenRouter vision models.

## Stack

- Bun
- Telegraf
- OpenRouter API
- No database

## Setup

1. Create a Telegram bot from [@BotFather](https://t.me/BotFather).
2. Copy the environment example:

```bash
cp .env.example .env
```

3. Fill `.env`:

```env
TELEGRAM_BOT_TOKEN=xxx
OPENROUTER_API_KEY=xxx
OPENROUTER_MODEL=google/gemma-4-31b-it:free
LOG_LEVEL=info
```

4. Install dependencies:

```bash
bun install
```

5. Run locally with polling:

```bash
bun run start
```

For development with watch mode:

```bash
bun run dev
```

Use `LOG_LEVEL=debug` if you need more local logs while testing.

## How It Works

1. User sends a food photo.
2. Bot picks the highest-resolution Telegram photo.
3. Bot gets the Telegram file URL.
4. Bot sends the image URL to OpenRouter chat completions API.
5. OpenRouter returns JSON with dish name, component breakdown, calories, confidence, and notes.
6. Bot formats the result into an Indonesian Telegram reply.

## Fallback Models

The bot uses `OPENROUTER_MODEL` first, then tries these free models:

```js
[
  "google/gemma-4-31b-it:free",
  "google/gemma-4-26b-a4b-it:free",
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
  "nvidia/nemotron-nano-12b-v2-vl:free"
]
```

These IDs should be checked against OpenRouter's models API if a free model starts returning rate limit or availability errors.

## Error Handling

- Non-photo messages: asks the user to send a food photo.
- OpenRouter limit or model errors: tries fallback models, then shows a retry message.
- Invalid JSON: shows the raw AI text as fallback.

## Project Structure

```text
calorie-telegram-bot/
├─ src/
│  ├─ bot.js
│  ├─ openrouter.js
│  ├─ prompts.js
│  └─ formatter.js
├─ .gitignore
├─ .env.example
├─ bun.lock
├─ package.json
└─ README.md
```
