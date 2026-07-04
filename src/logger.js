const LEVELS = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

const configuredLevel = process.env.LOG_LEVEL?.toLowerCase() || "info";
const minimumLevel = LEVELS[configuredLevel] || LEVELS.info;

function log(level, message, meta) {
  if (LEVELS[level] < minimumLevel) {
    return;
  }

  const timestamp = new Date().toISOString();
  const payload = meta ? ` ${JSON.stringify(meta)}` : "";
  const line = `[${timestamp}] ${level.toUpperCase()} ${message}${payload}`;

  if (level === "error") {
    console.error(line);
    return;
  }

  if (level === "warn") {
    console.warn(line);
    return;
  }

  console.log(line);
}

export const logger = {
  debug: (message, meta) => log("debug", message, meta),
  info: (message, meta) => log("info", message, meta),
  warn: (message, meta) => log("warn", message, meta),
  error: (message, meta) => log("error", message, meta)
};

export function toErrorMeta(error) {
  return {
    name: error?.name,
    message: error?.message,
    status: error?.response?.status,
    code: error?.code
  };
}
