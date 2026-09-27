import { MESSAGE_CLASSIFY, validPost } from "../shared.js";
import { classifyPost } from "./api.js";

function allowedSender(sender) {
  if (sender.id !== chrome.runtime.id || !sender.tab) return false;
  try {
    const url = new URL(sender.url);
    return url.protocol === "https:"
      && ["x.com", "www.x.com", "twitter.com", "www.twitter.com"].includes(url.hostname);
  } catch {
    return false;
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== MESSAGE_CLASSIFY) return false;
  if (!allowedSender(sender) || !validPost(message.post)) {
    sendResponse({ ok: false, error: "Invalid classification request." });
    return false;
  }
  (async () => {
    const { enabled = true } = await chrome.storage.local.get("enabled");
    if (!enabled) throw new Error("Classification is paused.");
    return classifyPost({ post_id: message.post.post_id, text: message.post.text });
  })().then(
    (result) => sendResponse({ ok: true, result }),
    (error) => sendResponse({ ok: false, error: error.message }),
  );
  return true;
});
