const CONFIDENCE_LABELS = {
  low: "rendah",
  medium: "sedang",
  high: "tinggi"
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function getTextValue(value) {
  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return "";
}

function getNumberValue(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.replace(",", ".").match(/\d+(?:\.\d+)?/);
    const number = normalized ? Number(normalized[0]) : NaN;
    return Number.isFinite(number) ? number : null;
  }

  return null;
}

function formatCalories(value) {
  const number = getNumberValue(value);
  if (number === null) {
    return null;
  }

  return `±${Math.round(number)} kcal`;
}

function getItemName(item) {
  if (!item || typeof item !== "object") {
    return getTextValue(item);
  }

  return (
    getTextValue(item.name) ||
    getTextValue(item.nama) ||
    getTextValue(item.ingredient) ||
    getTextValue(item.component) ||
    getTextValue(item.food)
  );
}

function normalizeItems(items) {
  return items
    .map((item) => {
      const name = getItemName(item);
      const calories = formatCalories(item?.calories ?? item?.kalori ?? item?.kcal);

      if (!name || !calories) {
        return null;
      }

      return {
        name,
        calories
      };
    })
    .filter(Boolean);
}

function formatTotalCalories(value, items) {
  const number = Number(value);

  if (Number.isFinite(number)) {
    return `±${Math.round(number)} kcal`;
  }

  const itemTotal = items.reduce((total, item) => {
    const calories = getNumberValue(item.calories);
    return calories === null ? total : total + calories;
  }, 0);

  return itemTotal > 0 ? `±${Math.round(itemTotal)} kcal` : "Belum bisa dihitung";
}

function getFoodTitle(result, items) {
  const dishName = getTextValue(result?.dish_name);

  if (dishName) {
    return escapeHtml(dishName);
  }

  const primaryItem = items.find((item) => item.name);

  if (!primaryItem) {
    return null;
  }

  return escapeHtml(primaryItem.name);
}

export function formatCalorieResult(result) {
  const items = normalizeItems(Array.isArray(result?.items) ? result.items : []);
  const foodTitle = getFoodTitle(result, items);
  const itemLines = items.length
    ? items.map((item) => {
        const name = escapeHtml(item.name);
        return `• ${name} — ${item.calories}`;
      })
    : ["• Tidak ada item makanan yang terdeteksi jelas"];

  const totalCalories = formatTotalCalories(result?.total_calories, items);
  const confidence = CONFIDENCE_LABELS[result?.confidence] || "low";
  const notes = escapeHtml(
    result?.notes || "Estimasi bisa berbeda tergantung porsi dan cara masak."
  );

  return [
    `🍽 <b>Estimasi Kalori${foodTitle ? ` - ${foodTitle}` : ""}</b>`,
    "",
    ...itemLines,
    "",
    `Total: <b>${totalCalories}</b>`,
    `Tingkat akurasi: ${confidence}`,
    "",
    `Catatan: ${notes}`
  ].join("\n");
}

export function formatRawFallback(rawText) {
  const text = escapeHtml(rawText || "AI belum bisa membaca hasilnya dengan rapi.");

  return [
    "🍽 <b>Estimasi Kalori</b>",
    "",
    "Balasan AI belum berupa JSON valid, tapi ini teks mentahnya:",
    "",
    text
  ].join("\n");
}
