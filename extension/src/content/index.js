import { MESSAGE_CLASSIFY } from "../shared.js";
import { hiddenCategories, VISIBILITY_PREFIX } from "../preferences.js";
import { ClassificationQueue } from "./classifier.js";
import { PostController } from "./controller.js";

const queue = new ClassificationQueue(async (post) => {
  let response;
  try {
    response = await chrome.runtime.sendMessage({ type: MESSAGE_CLASSIFY, post });
  } catch {
    throw new Error("Extension connection lost. Refresh this X tab.");
  }
  if (!response?.ok) throw new Error(response?.error || "Classification failed.");
  return response.result;
});
const controller = new PostController(document.body, queue);
let settings = {};
let initialized = false;
chrome.storage.local.get().then((stored) => {
  // Preserve newer events received while the initial read was pending.
  settings = { ...stored, ...settings };
  controller.enabled = settings.enabled !== false;
  controller.hiddenCategories = hiddenCategories(settings);
  initialized = true;
  controller.start();
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  for (const [key, change] of Object.entries(changes)) settings[key] = change.newValue;
  if (!initialized) return;
  if (Object.keys(changes).some((key) => key.startsWith(VISIBILITY_PREFIX))) {
    controller.setHiddenCategories(hiddenCategories(settings));
  }
  if (changes.enabled) controller.setEnabled(changes.enabled.newValue !== false);
});
