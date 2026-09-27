import { MAX_TEXT_LENGTH } from "../shared.js";

export const POST_SELECTOR = 'article[data-testid="tweet"]';
// X also puts role="link" on ordinary timestamp anchors. Only a containing
// div with that role denotes an embedded clickable card/quoted post.
const QUOTE_SELECTOR = '[data-testid="quoteTweet"], div[role="link"]';

function belongsToPost(element, article) {
  return element.closest(POST_SELECTOR) === article
    && !element.closest(QUOTE_SELECTOR);
}

export function extractPost(article) {
  const time = [...article.querySelectorAll("time")].find((node) => belongsToPost(node, article));
  const anchor = time?.closest('a[href*="/status/"]');
  const postId = anchor?.getAttribute("href")?.match(/\/status\/(\d+)(?:[/?#]|$)/)?.[1];
  if (!anchor || !postId) return null;
  const text = [...article.querySelectorAll('[data-testid="tweetText"]')]
    .filter((node) => belongsToPost(node, article))
    .map((node) => node.textContent.trim()).filter(Boolean).join("\n");
  return { post_id: postId, text: text.slice(0, MAX_TEXT_LENGTH), anchor };
}

export function postKey(post) {
  // Include text so an expanded or edited post is reclassified.
  return JSON.stringify([post.post_id, post.text]);
}
