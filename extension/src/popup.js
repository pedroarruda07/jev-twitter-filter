import { API_BASE } from "./shared.js";

const toggle = /** @type {HTMLInputElement} */ (document.querySelector("#enabled"));
const status = document.querySelector("#status");
const { enabled = true } = await chrome.storage.local.get("enabled");
toggle.checked = enabled;
toggle.addEventListener("change", () => chrome.storage.local.set({ enabled: toggle.checked }));
try {
  const response = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(3000) });
  if (!response.ok) throw new Error();
  status.textContent = "Backend connected";
  status.className = "connected";
} catch {
  status.textContent = "Backend offline — start the Python server.";
}
