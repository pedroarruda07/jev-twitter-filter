import { MESSAGE_CLASSIFY } from "../shared.js";
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
chrome.storage.local.get({ enabled: true }).then(({ enabled }) => {
  controller.enabled = enabled;
  controller.start();
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.enabled) controller.setEnabled(changes.enabled.newValue !== false);
});
