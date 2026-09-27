// Shared by feed badges and popup swatches. White text stays legible on each fill.
const COLORS = {
  news: "#b42318",
  ai: "#1d4ed8",
  ai_generated: "#7e22ce",
  tv: "#be185d",
  tech: "#0e7490",
  gaming: "#047857",
  sports: "#15803d",
  meme: "#92400e",
  other: "#475569",
};

export function categoryColor(id = "other") {
  if (Object.hasOwn(COLORS, id)) return COLORS[id];
  const hue = [...id].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) % 360, 0);
  return `hsl(${hue} 65% 32%)`;
}

export function validCategories(value) {
  return Array.isArray(value) && value.length >= 2 && value.length <= 20
    && new Set(value.map((category) => category?.id)).size === value.length
    && value.every((category) => typeof category?.id === "string"
      && /^[a-z][a-z0-9_]{0,39}$/.test(category.id)
      && typeof category.label === "string" && category.label.length > 0 && category.label.length <= 40);
}
