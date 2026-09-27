import { API_BASE, validClassification } from "../shared.js";

export async function classifyPost(post, fetcher = fetch) {
  let response;
  try {
    response = await fetcher(`${API_BASE}/api/classify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(post),
      signal: AbortSignal.timeout(25000),
      credentials: "omit",
      redirect: "error",
    });
  } catch {
    throw new Error("Backend unavailable. Start the Python server, then click to retry.");
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(typeof data?.detail === "string" ? data.detail : "Classification failed.");
  }
  if (!validClassification(data, post.post_id)) throw new Error("Invalid backend response.");
  return data;
}
