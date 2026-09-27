import { API_BASE } from "./shared.js";
import { categoryColor, validCategories } from "./categories.js";
import { visibilityKey } from "./preferences.js";

const toggle = /** @type {HTMLInputElement} */ (document.querySelector("#enabled"));
const status = document.querySelector("#status");
const filterStatus = document.querySelector("#filter-status");
const list = document.querySelector("#categories");
const inputs = new Map();
const settings = await chrome.storage.local.get();
toggle.checked = settings.enabled !== false;

async function save(input, key) {
  try {
    await chrome.storage.local.set({ [key]: input.checked });
    filterStatus.textContent = "";
  } catch {
    input.checked = settings[key] !== false;
    filterStatus.textContent = "Could not save your selection. Please try again.";
  }
}

toggle.addEventListener("change", () => save(toggle, "enabled"));
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  for (const [key, change] of Object.entries(changes)) {
    settings[key] = change.newValue;
    const input = key === "enabled" ? toggle : inputs.get(key);
    if (input) input.checked = change.newValue !== false;
  }
});

function renderCategories(categories) {
  list.replaceChildren();
  inputs.clear();
  for (const category of categories) {
    const key = visibilityKey(category.id);
    const label = document.createElement("label");
    label.className = "category-option";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = settings[key] !== false;
    input.addEventListener("change", () => save(input, key));
    const chip = document.createElement("span");
    chip.className = "category-chip";
    chip.textContent = category.label;
    chip.style.backgroundColor = categoryColor(category.id);
    label.append(input, chip);
    list.append(label);
    inputs.set(key, input);
  }
}

// Cached/bundled categories keep filters usable while the server is offline.
if (validCategories(settings.cachedCategories)) {
  renderCategories(settings.cachedCategories);
} else {
  try {
    const bundled = await fetch(chrome.runtime.getURL("categories.json")).then((response) => response.json());
    if (!validCategories(bundled)) throw new Error();
    renderCategories(bundled);
  } catch {
    list.textContent = "Categories unavailable. Start the backend and reopen this popup.";
  }
}

try {
  const response = await fetch(`${API_BASE}/api/categories`, { signal: AbortSignal.timeout(3000) });
  if (!response.ok) throw new Error();
  const categories = await response.json();
  if (!validCategories(categories)) throw new Error();
  renderCategories(categories);
  status.textContent = "Backend connected";
  status.className = "connected";
  await chrome.storage.local.set({ cachedCategories: categories });
} catch {
  status.textContent = "Backend offline — start the Python server.";
}
