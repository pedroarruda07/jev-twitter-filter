export const API_BASE = "http://127.0.0.1:8000";
export const MAX_TEXT_LENGTH = 20000;
export const MESSAGE_CLASSIFY = "jev:classify";

export function validPost(post) {
  return post && /^\d{1,30}$/.test(post.post_id) && typeof post.text === "string"
    && post.text.trim().length > 0 && post.text.length <= MAX_TEXT_LENGTH;
}

export function validClassification(result, postId) {
  return result && result.post_id === postId
    && typeof result.category === "string" && /^[a-z][a-z0-9_]{0,39}$/.test(result.category)
    && typeof result.label === "string" && result.label.length > 0 && result.label.length <= 40
    && typeof result.confidence === "number" && Number.isFinite(result.confidence)
    && result.confidence >= 0 && result.confidence <= 1;
}
